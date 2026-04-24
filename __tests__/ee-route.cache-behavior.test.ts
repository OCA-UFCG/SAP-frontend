import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/app/api/ee/services", () => ({
  ensureEeCacheWarmupStarted: vi.fn(),
  getEarthEngineUrl: vi.fn(),
}));

import { POST } from "@/app/api/ee/route";
import { getEarthEngineUrl } from "@/app/api/ee/services";
import { buildCacheKey, removeCacheUrl } from "@/app/api/ee/cache";

const mockedGetEarthEngineUrl = vi.mocked(getEarthEngineUrl);

function createMockRequest(url: string, body: unknown): NextRequest {
  return {
    nextUrl: new URL(url),
    json: vi.fn().mockResolvedValue(body),
  } as unknown as NextRequest;
}

const layerV1 = {
  id: "layer-a",
  name: "Layer A",
  description: "Layer A",
  measurementUnit: "%",
  poster: "/poster.png",
  imageData: {
    "2024": {
      default: true,
      imageId: "projects/example/image-v1",
      imageParams: [{ color: "#111111", label: "old" }],
    },
  },
  minScale: 0,
  maxScale: 1,
  type: "raster",
};

const layerV2 = {
  ...layerV1,
  imageData: {
    "2024": {
      default: true,
      imageId: "projects/example/image-v2",
      imageParams: [{ color: "#EEEEEE", label: "new" }],
    },
  },
  minScale: 10,
  maxScale: 100,
};

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
    removeCacheUrl(cacheKeyV1);
    removeCacheUrl(cacheKeyV2);
  });

  afterEach(() => {
    removeCacheUrl(cacheKeyV1);
    removeCacheUrl(cacheKeyV2);
  });

  it("recomputes URL when visualization config changes for same layer and year", async () => {
    mockedGetEarthEngineUrl
      .mockResolvedValueOnce("https://tiles.example/layer-a/v1")
      .mockResolvedValueOnce("https://tiles.example/layer-a/v2");

    const firstReq = createMockRequest(
      "https://example.test/api/ee?name=layer-a&year=2024",
      layerV1,
    );
    const firstRes = await POST(firstReq);
    const firstBody = (await firstRes.json()) as { url?: string };

    const secondReq = createMockRequest(
      "https://example.test/api/ee?name=layer-a&year=2024",
      layerV2,
    );
    const secondRes = await POST(secondReq);
    const secondBody = (await secondRes.json()) as { url?: string };

    expect(firstRes.status).toBe(200);
    expect(firstBody.url).toBe("https://tiles.example/layer-a/v1");

    expect(secondRes.status).toBe(200);
    expect(secondBody.url).toBe("https://tiles.example/layer-a/v2");
    expect(mockedGetEarthEngineUrl).toHaveBeenCalledTimes(2);
  });

  it("validates request payload even when a cache entry already exists", async () => {
    mockedGetEarthEngineUrl.mockResolvedValueOnce(
      "https://tiles.example/layer-a/v1",
    );

    const warmReq = createMockRequest(
      "https://example.test/api/ee?name=layer-a&year=2024",
      layerV1,
    );
    await POST(warmReq);

    const invalidPayloadReq = createMockRequest(
      "https://example.test/api/ee?name=layer-a&year=2024",
      {
        ...layerV1,
        imageData: {
          "2023": {
            default: true,
            imageId: "projects/example/other-year",
            imageParams: [{ color: "#000000", label: "invalid" }],
          },
        },
      },
    );

    const res = await POST(invalidPayloadReq);
    const body = (await res.json()) as { error?: string };

    expect(res.status).toBe(400);
    expect(body.error).toContain("Year 2024 not found");
  });
});
