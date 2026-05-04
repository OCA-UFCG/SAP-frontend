import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("@/app/api/ee/services", () => ({
  ensureEeCacheWarmupStarted: vi.fn(),
  getEarthEngineUrl: vi.fn(),
}));

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(),
}));

import { POST } from "@/app/api/ee/route";
import { getEarthEngineUrl } from "@/app/api/ee/services";
import { buildCacheKey, removeCacheUrl } from "@/app/api/ee/cache";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";

const mockedGetEarthEngineUrl = vi.mocked(getEarthEngineUrl);
const mockedGetPanelLayers = vi.mocked(getPanelLayers);

function createMockRequest(url: string): NextRequest {
  return {
    nextUrl: new URL(url),
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
    removeCacheUrl(cacheKeyV1);
    removeCacheUrl(cacheKeyV2);
  });

  afterEach(() => {
    removeCacheUrl(cacheKeyV1);
    removeCacheUrl(cacheKeyV2);
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
    );
  });

  it("ignores any body payload and resolves the layer only from name/year", async () => {
    mockedGetEarthEngineUrl.mockResolvedValueOnce(
      "https://tiles.example/layer-a/v1",
    );

    const request = {
      nextUrl: new URL("https://example.test/api/ee?name=layer-a&year=2024"),
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
});
