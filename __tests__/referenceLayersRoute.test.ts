import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

// A rota alcança `@/app/api/ee/referenceLayers`, que é um módulo de servidor.
vi.mock("server-only", () => ({}));

vi.mock("@/app/api/ee/services", () => ({
  ensureEeCacheWarmupStarted: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("user-123"),
}));

vi.mock("@/infrastructure/earth-engine/client", () => ({
  initializeGee: vi.fn().mockResolvedValue(undefined),
}));

const getMapId = vi.fn();
vi.mock("@google/earthengine", () => ({
  default: {
    FeatureCollection: () => ({ style: () => ({ getMapId }) }),
  },
}));

import { POST } from "@/app/api/ee/reference-layers/route";
import { removeCacheUrl } from "@/app/api/ee/cache";
import { clearEeRateLimit } from "@/app/api/ee/rate-limit";
import { getAuthenticatedUserId } from "@/lib/server-session";

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
  getMapId.mockReset();
  getMapId.mockImplementation(
    (_params: unknown, callback: (obj: unknown, error?: string) => void) =>
      callback({ urlFormat: "https://earthengine.example/tiles/{z}/{x}/{y}" }),
  );
  mockedGetAuthenticatedUserId.mockResolvedValue("user-123");
  clearEeRateLimit("user-123");
  for (const layerId of REFERENCE_LAYER_IDS) {
    removeCacheUrl(`ref-overlay-v1:${layerId}`);
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
    expect(getMapId).not.toHaveBeenCalled();
  });

  it("returns the tile URL of a known reference layer", async () => {
    const response = await POST(createMockRequest("terras_indigenas"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://earthengine.example/tiles/{z}/{x}/{y}",
    });
  });

  it("rejects an unknown layer naming the valid values", async () => {
    const response = await POST(createMockRequest("municipios"));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain('"municipios"');
    expect(body.error).toContain("quilombolas");
    expect(getMapId).not.toHaveBeenCalled();
  });

  it("serves a repeated request from the cache instead of calling Earth Engine again", async () => {
    await POST(createMockRequest("assentamentos"));
    await POST(createMockRequest("assentamentos"));

    expect(getMapId).toHaveBeenCalledTimes(1);
  });

  it("propagates an Earth Engine failure as a 500 without caching it", async () => {
    getMapId.mockImplementation(
      (_params: unknown, callback: (obj: unknown, error?: string) => void) =>
        callback(null, "Asset not found."),
    );

    const failed = await POST(createMockRequest("unidades_conservacao"));
    expect(failed.status).toBe(500);

    getMapId.mockImplementation(
      (_params: unknown, callback: (obj: unknown, error?: string) => void) =>
        callback({ urlFormat: "https://earthengine.example/uc/{z}/{x}/{y}" }),
    );
    const retried = await POST(createMockRequest("unidades_conservacao"));

    expect(retried.status).toBe(200);
  });
});
