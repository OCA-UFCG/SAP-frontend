import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/app/api/ee/services", () => ({
  ensureEeCacheWarmupStarted: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("user-123"),
}));

const getGeeMapUrl = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/earth-engine/client", () => ({
  initializeGee: vi.fn().mockResolvedValue(undefined),
  getGeeMapUrl,
}));

interface FakeStyledImage {
  blend: (top: FakeStyledImage) => FakeStyledImage;
}
const fakeStyledImage = (): FakeStyledImage => ({
  blend: () => fakeStyledImage(),
});
const styleFeatureCollection = vi.fn(fakeStyledImage);
vi.mock("@google/earthengine", () => ({
  default: {
    FeatureCollection: () => ({ style: styleFeatureCollection }),
  },
}));

import { POST } from "@/app/api/ee/reference-layers/route";
import { removeCacheUrl } from "@/app/api/ee/cache";
import { clearEeRateLimit } from "@/app/api/ee/rate-limit";
import { getAuthenticatedUserId } from "@/lib/server-session";
import { REFERENCE_LAYER_SWATCHES } from "@/components/MapLayerContext/mapLayerState";

const mockedGetAuthenticatedUserId = vi.mocked(getAuthenticatedUserId);

const REFERENCE_LAYER_IDS = [
  "quilombolas",
  "assentamentos",
  "terras_indigenas",
  "unidades_conservacao",
] as const;

function createMockRequest(layer: string): NextRequest {
  return {
    nextUrl: new URL(`http://localhost/api/ee/reference-layers?layer=${layer}`),
    headers: new Headers({ Cookie: "session=mock-session-cookie" }),
  } as unknown as NextRequest;
}

beforeEach(() => {
  getGeeMapUrl.mockReset();
  getGeeMapUrl.mockResolvedValue("https://earthengine.example/tiles/{z}/{x}/{y}");
  mockedGetAuthenticatedUserId.mockResolvedValue("user-123");
  clearEeRateLimit("user-123");
  for (const layerId of REFERENCE_LAYER_IDS) {
    removeCacheUrl(`ref-overlay-v3:${layerId}:outline`);
    removeCacheUrl(`ref-overlay-v3:${layerId}:fill`);
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/ee/reference-layers", () => {
  it("returns 401 before touching Earth Engine when there is no session", async () => {
    mockedGetAuthenticatedUserId.mockResolvedValue(null);

    const response = await POST(createMockRequest("quilombolas"));

    expect(response.status).toBe(401);
    expect(getGeeMapUrl).not.toHaveBeenCalled();
  });

  it("returns separate tile URLs for the outline and the fill", async () => {
    getGeeMapUrl.mockImplementation(
      async () =>
        `https://earthengine.example/tiles/${getGeeMapUrl.mock.calls.length}/{z}/{x}/{y}`,
    );

    const response = await POST(createMockRequest("terras_indigenas"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://earthengine.example/tiles/1/{z}/{x}/{y}",
      fillUrl: "https://earthengine.example/tiles/2/{z}/{x}/{y}",
    });
  });

  // Numa imagem só, o cliente não conseguiria desbotar o interior sem desbotar
  // o contorno junto.
  it("paints the outline without fill and the fill without outline", async () => {
    await POST(createMockRequest("terras_indigenas"));

    const [haloStyle, outlineStyle, fillStyle] =
      styleFeatureCollection.mock.calls.map(
        (call) => (call as unknown as [Record<string, unknown>])[0],
      );
    // O halo claro por baixo mantém a linha legível sobre índices escuros.
    expect(haloStyle).toEqual({
      color: "FFFFFFCC",
      fillColor: "00000000",
      width: 3.5,
    });
    expect(outlineStyle).toEqual({
      color: "6B3E1F",
      fillColor: "00000000",
      width: 1.5,
    });
    expect(fillStyle).toEqual({
      color: "00000000",
      fillColor: "8B572A",
      width: 0,
    });
  });

  it("styles each territory with its own color, keeping assentamentos gray", async () => {
    for (const layerId of REFERENCE_LAYER_IDS) {
      await POST(createMockRequest(layerId));
    }

    const fillColors = styleFeatureCollection.mock.calls
      .map((call) => (call as unknown as [{ fillColor: string }])[0].fillColor)
      .filter((color) => color !== "00000000");
    expect(fillColors).toEqual(["8E2437", "CCCCCC", "8B572A", "2E6B3F"]);
  });

  it("paints each territory with the colors its checkbox shows", async () => {
    for (const layerId of REFERENCE_LAYER_IDS) {
      styleFeatureCollection.mockClear();
      await POST(createMockRequest(layerId));

      // O contorno é um halo claro com a linha colorida por cima; o interior
      // é uma imagem à parte. Só a linha e o interior carregam a cor da camada.
      const styles = styleFeatureCollection.mock.calls.map(
        (call) =>
          (call as unknown as [{ color: string; fillColor: string }])[0],
      );
      const swatch = REFERENCE_LAYER_SWATCHES[layerId];
      expect(styles.map((style) => `#${style.color}`)).toContain(
        swatch.outline,
      );
      expect(
        styles.map((style) => `#${style.fillColor.slice(0, 6)}`),
      ).toContain(swatch.fill);
    }
  });

  it("rejects an unknown layer naming the valid values", async () => {
    const response = await POST(createMockRequest("municipios"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('"municipios"');
    expect(body.error).toContain("quilombolas");
    expect(getGeeMapUrl).not.toHaveBeenCalled();
  });

  it("serves a repeated request from the cache instead of calling Earth Engine again", async () => {
    await POST(createMockRequest("assentamentos"));
    await POST(createMockRequest("assentamentos"));

    // Uma chamada para o contorno e outra para o interior, só na primeira vez.
    expect(getGeeMapUrl).toHaveBeenCalledTimes(2);
  });

  it("propagates an Earth Engine failure as a 500 without caching it", async () => {
    getGeeMapUrl.mockRejectedValue(new Error("Asset not found."));

    const failed = await POST(createMockRequest("unidades_conservacao"));
    expect(failed.status).toBe(500);

    getGeeMapUrl.mockResolvedValue("https://earthengine.example/uc/{z}/{x}/{y}");
    const retried = await POST(createMockRequest("unidades_conservacao"));

    expect(retried.status).toBe(200);
  });
});
