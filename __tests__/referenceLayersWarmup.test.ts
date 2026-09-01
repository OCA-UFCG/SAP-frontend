import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/infrastructure/earth-engine/client", () => ({
  initializeGee: vi.fn().mockResolvedValue(undefined),
}));

const getMapId = vi.fn();
vi.mock("@google/earthengine", () => ({
  default: {
    FeatureCollection: () => ({ style: () => ({ getMapId }) }),
  },
}));

import {
  addUrlToCache,
  getCachedUrl,
  removeCacheUrl,
} from "@/app/api/ee/cache";
import {
  REFERENCE_LAYER_ASSETS,
  buildReferenceLayerCacheKey,
  warmReferenceLayerUrls,
} from "@/app/api/ee/referenceLayers";

const LAYER_IDS = Object.keys(REFERENCE_LAYER_ASSETS);

type MapIdCallback = (obj: unknown, error?: string) => void;

const respondWithUrl =
  (url: string) => (_params: unknown, callback: MapIdCallback) =>
    callback({ urlFormat: url });

beforeEach(() => {
  getMapId.mockReset();
  getMapId.mockImplementation(
    respondWithUrl("https://earthengine.example/tiles/{z}/{x}/{y}"),
  );
  for (const layerId of LAYER_IDS) {
    removeCacheUrl(buildReferenceLayerCacheKey(layerId));
  }
});

describe("warmReferenceLayerUrls", () => {
  it("caches a tile URL for every territory", async () => {
    await warmReferenceLayerUrls();

    expect(getMapId).toHaveBeenCalledTimes(LAYER_IDS.length);
    for (const layerId of LAYER_IDS) {
      expect(getCachedUrl(buildReferenceLayerCacheKey(layerId))).toBe(
        "https://earthengine.example/tiles/{z}/{x}/{y}",
      );
    }
  });

  it("skips a territory whose URL is already cached", async () => {
    addUrlToCache(
      buildReferenceLayerCacheKey("quilombolas"),
      "https://earthengine.example/ja-aquecida/{z}/{x}/{y}",
    );

    await warmReferenceLayerUrls();

    expect(getMapId).toHaveBeenCalledTimes(LAYER_IDS.length - 1);
    expect(getCachedUrl(buildReferenceLayerCacheKey("quilombolas"))).toBe(
      "https://earthengine.example/ja-aquecida/{z}/{x}/{y}",
    );
  });

  // O warmup das camadas do painel roda logo depois deste, dentro do mesmo
  // try: um asset quebrado aqui não pode derrubar o aquecimento inteiro.
  it("keeps warming the other territories when one asset fails", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    getMapId.mockImplementationOnce(
      (_params: unknown, callback: MapIdCallback) =>
        callback(null, "Asset not found"),
    );

    await expect(warmReferenceLayerUrls()).resolves.toBeUndefined();

    expect(
      getCachedUrl(buildReferenceLayerCacheKey(LAYER_IDS[0])),
    ).toBeUndefined();
    for (const layerId of LAYER_IDS.slice(1)) {
      expect(getCachedUrl(buildReferenceLayerCacheKey(layerId))).toBe(
        "https://earthengine.example/tiles/{z}/{x}/{y}",
      );
    }
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining("[referenceLayers]"),
      expect.anything(),
    );
    consoleError.mockRestore();
  });
});
