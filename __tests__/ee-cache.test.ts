import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addUrlToCache,
  buildCacheKey,
  CACHE_TTL_MS,
  clearEarthEngineCacheForLayer,
  getCachedUrl,
  hasKey,
  removeCacheUrl,
} from "@/app/api/ee/cache";

describe("ee cache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the versioned key format consistently", () => {
    expect(buildCacheKey("layer-a", "2024")).toBe(
      'v8:layer-a:2024:{"imageId":null,"imageParams":null,"minScale":null,"maxScale":null,"mapVisualization":null,"imageCollectionSelection":null}:national:brasil',
    );
  });

  it("uses the canonical national selection and separates other scopes", () => {
    const defaultKey = buildCacheKey("layer-a", "2024");
    const explicitNationalKey = buildCacheKey(
      "layer-a",
      "2024",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { spatialArea: "national", spatialValue: "brasil" },
    );
    const regionalKey = buildCacheKey(
      "layer-a",
      "2024",
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      { spatialArea: "region", spatialValue: "Nordeste" },
    );

    expect(explicitNationalKey).toBe(defaultKey);
    expect(regionalKey).not.toBe(defaultKey);
  });

  it("stores and retrieves cached urls by the generated key", () => {
    const cacheKey = buildCacheKey(
      "layer-a",
      "2024",
      "projects/example/image",
      [{ color: "#111111", label: "Legend" }],
      0,
      1,
    );

    addUrlToCache(cacheKey, "https://tiles.example/layer-a/2024");

    expect(hasKey(cacheKey)).toBe(true);
    expect(getCachedUrl(cacheKey)).toBe("https://tiles.example/layer-a/2024");

    removeCacheUrl(cacheKey);
  });

  it("expires entries after the configured ttl", () => {
    vi.useFakeTimers();

    const cacheKey = buildCacheKey(
      "layer-b",
      "2023",
      "projects/example/image",
      [{ color: "#222222", label: "Legend" }],
      5,
      15,
    );
    addUrlToCache(cacheKey, "https://tiles.example/layer-b/2023");

    vi.advanceTimersByTime(CACHE_TTL_MS + 1);

    expect(hasKey(cacheKey)).toBe(false);
    expect(getCachedUrl(cacheKey)).toBeUndefined();
  });

  it("evicts the least recently used url when the cache exceeds its limit", () => {
    vi.stubEnv("EE_URL_CACHE_MAX_ENTRIES", "2");
    clearEarthEngineCacheForLayer("bounded-layer");

    const firstKey = buildCacheKey("bounded-layer", "2001");
    const secondKey = buildCacheKey("bounded-layer", "2002");
    const thirdKey = buildCacheKey("bounded-layer", "2003");

    addUrlToCache(firstKey, "https://tiles.example/2001");
    addUrlToCache(secondKey, "https://tiles.example/2002");
    // Reading the first key makes the second one the least recently used.
    expect(getCachedUrl(firstKey)).toBe("https://tiles.example/2001");
    addUrlToCache(thirdKey, "https://tiles.example/2003");

    expect(hasKey(secondKey)).toBe(false);
    expect(getCachedUrl(firstKey)).toBe("https://tiles.example/2001");
    expect(getCachedUrl(thirdKey)).toBe("https://tiles.example/2003");

    vi.unstubAllEnvs();
    clearEarthEngineCacheForLayer("bounded-layer");
  });
});
