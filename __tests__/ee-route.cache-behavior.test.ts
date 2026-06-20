import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/app/api/ee/services", () => ({
  ensureEeCacheWarmupStarted: vi.fn(),
  getGeeRuntimeDiagnostics: vi.fn(() => ({
    phase: "authentication",
    runtime: { node: "v22.0.0" },
  })),
  getEarthEngineUrl: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  getAuthenticatedUserId: vi.fn().mockResolvedValue("user-123"),
  requireAuthenticatedRequest: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(),
}));

import { POST } from "@/app/api/ee/route";
import {
  clearEeRateLimit,
  consumeEeRateLimit,
  EE_RATE_LIMIT_MAX_REQUESTS,
} from "../src/app/api/ee/rate-limit";
import { getEarthEngineUrl } from "@/app/api/ee/services";
import { buildCacheKey, removeCacheUrl } from "@/app/api/ee/cache";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { getAuthenticatedUserId } from "@/lib/server-session";

const mockedGetEarthEngineUrl = vi.mocked(getEarthEngineUrl);
const mockedGetPanelLayers = vi.mocked(getPanelLayers);
const mockedGetAuthenticatedUserId = vi.mocked(getAuthenticatedUserId);

function createMockRequest(
  url: string,
  forwardedFor = "203.0.113.10",
): NextRequest {
  return {
    nextUrl: new URL(url),
    headers: new Headers({
      "x-forwarded-for": forwardedFor,
      Cookie: "session=mock-session-cookie",
    }),
  } as unknown as NextRequest;
}

function createMockLayer(
  imageId = "projects/example/image-v1",
  imageParams = [{ color: "#111111", label: "old" }],
  minScale = 0,
  maxScale = 1,
) {
  return {
    sys: { id: "1" },
    name: "Layer A",
    id: "layer-a",
    description: "",
    panelPosition: 1,
    previewMap: { url: "", title: "", width: 0, height: 0 },
    imageData: {
      "2024": {
        default: true,
        imageId,
        imageParams,
      },
    },
    minScale,
    maxScale,
  };
}

describe("POST /api/ee cache behavior", () => {
  const cacheKeyV1 = buildCacheKey(
    "layer-a",
    "2024",
    "projects/example/image-v1",
    [{ color: "#111111", label: "old" }],
    0,
    1,
  );
  const cacheKeyV2 = buildCacheKey(
    "layer-a",
    "2024",
    "projects/example/image-v2",
    [{ color: "#EEEEEE", label: "new" }],
    10,
    100,
  );

  beforeEach(() => {
    mockedGetEarthEngineUrl.mockReset();
    mockedGetPanelLayers.mockResolvedValue([createMockLayer()]);
    mockedGetAuthenticatedUserId.mockReset();
    mockedGetAuthenticatedUserId.mockResolvedValue("user-123");
    clearEeRateLimit();
    removeCacheUrl(cacheKeyV1);
    removeCacheUrl(cacheKeyV2);
  });

  afterEach(() => {
    clearEeRateLimit();
    removeCacheUrl(cacheKeyV1);
    removeCacheUrl(cacheKeyV2);
  });

  it("returns 401 before processing layers when the session is invalid", async () => {
    mockedGetAuthenticatedUserId.mockResolvedValueOnce(null);

    const request = createMockRequest(
      "https://example.test/api/ee?name=layer-a&year=2024",
    );

    const res = await POST(request);
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(401);
    expect(body.error).toBe("Unauthorized access.");
    expect(mockedGetPanelLayers).not.toHaveBeenCalled();
    expect(mockedGetEarthEngineUrl).not.toHaveBeenCalled();
  });

  it("keys the rate limit by authenticated user instead of forwarded headers", () => {
    const first = consumeEeRateLimit("user-123");
    const second = consumeEeRateLimit("user-123");
    const otherUser = consumeEeRateLimit("user-456");

    expect(first.limited).toBe(false);
    expect(second.headers["X-RateLimit-Remaining"]).toBe(
      String(EE_RATE_LIMIT_MAX_REQUESTS - 2),
    );
    expect(otherUser.headers["X-RateLimit-Remaining"]).toBe(
      String(EE_RATE_LIMIT_MAX_REQUESTS - 1),
    );
  });

  it("caches the generated URL for the same layer and year", async () => {
    mockedGetEarthEngineUrl.mockResolvedValueOnce(
      "https://tiles.example/layer-a/v1",
    );

    const request = createMockRequest(
      "https://example.test/api/ee?name=layer-a&year=2024",
    );

    const firstRes = await POST(request);
    const firstBody = (await firstRes.json()) as { url?: string };
    const secondRes = await POST(request);
    const secondBody = (await secondRes.json()) as { url?: string };

    expect(firstRes.status).toBe(200);
    expect(firstBody.url).toBe("https://tiles.example/layer-a/v1");

    expect(secondRes.status).toBe(200);
    expect(secondBody.url).toBe("https://tiles.example/layer-a/v1");
    expect(mockedGetEarthEngineUrl).toHaveBeenCalledTimes(1);
  });

  it("returns 500 when Earth Engine cannot generate a tile URL", async () => {
    mockedGetEarthEngineUrl.mockRejectedValueOnce(
      new Error("Earth Engine initialization failed"),
    );

    const request = createMockRequest(
      "https://example.test/api/ee?name=layer-a&year=2024",
    );

    const res = await POST(request);
    const body = (await res.json()) as {
      diagnostics?: {
        error?: { message?: string };
        gee?: { phase?: string };
        requestId?: string;
      };
      error?: string;
    };

    expect(res.status).toBe(500);
    expect(body.error).toBe("Earth Engine initialization failed");
    expect(body.diagnostics?.error?.message).toBe(
      "Earth Engine initialization failed",
    );
    expect(body.diagnostics?.gee?.phase).toBe("authentication");
    expect(body.diagnostics?.requestId).toBeTruthy();
    expect(res.headers.get("X-EE-Request-ID")).toBe(
      body.diagnostics?.requestId,
    );
  });

  it("recomputes the URL when the server-side layer config changes", async () => {
    mockedGetEarthEngineUrl
      .mockResolvedValueOnce("https://tiles.example/layer-a/v1")
      .mockResolvedValueOnce("https://tiles.example/layer-a/v2");

    const request = createMockRequest(
      "https://example.test/api/ee?name=layer-a&year=2024",
    );

    const firstRes = await POST(request);
    const firstBody = (await firstRes.json()) as { url?: string };

    mockedGetPanelLayers.mockResolvedValueOnce([
      createMockLayer(
        "projects/example/image-v2",
        [{ color: "#EEEEEE", label: "new" }],
        10,
        100,
      ),
    ]);

    const secondRes = await POST(request);
    const secondBody = (await secondRes.json()) as { url?: string };

    expect(firstRes.status).toBe(200);
    expect(firstBody.url).toBe("https://tiles.example/layer-a/v1");

    expect(secondRes.status).toBe(200);
    expect(secondBody.url).toBe("https://tiles.example/layer-a/v2");
    expect(mockedGetEarthEngineUrl).toHaveBeenCalledTimes(2);
    expect(mockedGetEarthEngineUrl).toHaveBeenNthCalledWith(
      2,
      "projects/example/image-v2",
      [{ color: "#EEEEEE", label: "new" }],
      10,
      100,
      { mapVisualization: undefined },
    );
  });

  it("passes compact map visualization metadata to Earth Engine rendering", async () => {
    const mapVisualization = {
      min: 1,
      max: 6,
      palette: ["#111111", "#222222"],
      band: "gpp_class",
      sourceBand: "Gpp",
      thresholds: [7000, 13000],
    };

    mockedGetPanelLayers.mockResolvedValueOnce([
      {
        ...createMockLayer(),
        imageData: {
          type: "territorial-compact",
          schemaVersion: 1,
          defaultYear: "2025",
          classes: [
            { id: "low", label: "Low", color: "#111111", pixelLimit: 1 },
            { id: "high", label: "High", color: "#222222", pixelLimit: 2 },
          ],
          mapVisualization,
          years: {
            "2025": {
              imageId: "MODIS/061/MOD17A3HGF/2025_01_01",
              values: { br: [500, 500] },
            },
          },
        },
      },
    ]);
    mockedGetEarthEngineUrl.mockResolvedValueOnce(
      "https://tiles.example/layer-a/gpp",
    );

    const res = await POST(
      createMockRequest("https://example.test/api/ee?name=layer-a&year=2025"),
    );

    expect(res.status).toBe(200);
    expect(mockedGetEarthEngineUrl).toHaveBeenCalledWith(
      "MODIS/061/MOD17A3HGF/2025_01_01",
      [
        { color: "#111111", label: "Low", pixelLimit: 1 },
        { color: "#222222", label: "High", pixelLimit: 2 },
      ],
      0,
      1,
      { mapVisualization },
    );
  });

  it("ignores any body payload and resolves the layer only from name/year", async () => {
    mockedGetEarthEngineUrl.mockResolvedValueOnce(
      "https://tiles.example/layer-a/v1",
    );

    const request = {
      nextUrl: new URL("https://example.test/api/ee?name=layer-a&year=2024"),
      headers: new Headers({
        "x-forwarded-for": "203.0.113.10",
        Cookie: "session=mock-session-cookie",
      }),
      json: vi.fn().mockResolvedValue({
        imageId: "projects/example/image-v2",
        imageParams: [{ color: "#000000", label: "ignored" }],
      }),
    } as unknown as NextRequest;

    const res = await POST(request);
    const body = (await res.json()) as { url?: string };

    expect(res.status).toBe(200);
    expect(body.url).toBe("https://tiles.example/layer-a/v1");
    expect(mockedGetEarthEngineUrl).toHaveBeenCalledTimes(1);
  });

  it("returns 429 after too many requests from the same client", async () => {
    mockedGetEarthEngineUrl.mockResolvedValue(
      "https://tiles.example/layer-a/v1",
    );

    const requestUrl = "https://example.test/api/ee?name=layer-a&year=2024";

    for (let attempt = 0; attempt < EE_RATE_LIMIT_MAX_REQUESTS; attempt++) {
      const res = await POST(createMockRequest(requestUrl, "198.51.100.7"));
      expect(res.status).toBe(200);
    }

    const limitedRes = await POST(
      createMockRequest(requestUrl, "198.51.100.7"),
    );
    const body = (await limitedRes.json()) as { error?: string };

    expect(limitedRes.status).toBe(429);
    expect(body.error).toBe("Too many Earth Engine requests. Try again later.");
    expect(limitedRes.headers.get("Retry-After")).toBeTruthy();
    expect(limitedRes.headers.get("X-RateLimit-Limit")).toBe(
      String(EE_RATE_LIMIT_MAX_REQUESTS),
    );
    expect(mockedGetEarthEngineUrl).toHaveBeenCalledTimes(1);
  });

  it("tracks rate limits independently per client", async () => {
    mockedGetEarthEngineUrl.mockResolvedValue(
      "https://tiles.example/layer-a/v1",
    );

    const requestUrl = "https://example.test/api/ee?name=layer-a&year=2024";

    for (let attempt = 0; attempt < EE_RATE_LIMIT_MAX_REQUESTS; attempt++) {
      mockedGetAuthenticatedUserId.mockResolvedValueOnce("user-123");
      await POST(createMockRequest(requestUrl, "198.51.100.11"));
    }

    mockedGetAuthenticatedUserId.mockResolvedValueOnce("user-456");
    const otherClientRes = await POST(
      createMockRequest(requestUrl, "198.51.100.12"),
    );
    const otherClientBody = (await otherClientRes.json()) as { url?: string };

    expect(otherClientRes.status).toBe(200);
    expect(otherClientBody.url).toBe("https://tiles.example/layer-a/v1");
  });
});
