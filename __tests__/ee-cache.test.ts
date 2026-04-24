import { afterEach, describe, expect, it, vi } from "vitest";

import {
  addUrlToCache,
  buildCacheKey,
  CACHE_TTL_MS,
  getCachedUrl,
  hasKey,
  removeCacheUrl,
} from "@/app/api/ee/cache";

describe("ee cache", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses the versioned key format consistently", () => {
    expect(buildCacheKey("layer-a", "2024")).toBe("v2:layer-a:2024");
  });

  it("stores and retrieves cached urls by the generated key", () => {
    const cacheKey = buildCacheKey("layer-a", "2024");

    addUrlToCache(cacheKey, "https://tiles.example/layer-a/2024");

    expect(hasKey(cacheKey)).toBe(true);
    expect(getCachedUrl(cacheKey)).toBe("https://tiles.example/layer-a/2024");

    removeCacheUrl(cacheKey);
  });

  it("expires entries after the configured ttl", () => {
    vi.useFakeTimers();

    const cacheKey = buildCacheKey("layer-b", "2023");
    addUrlToCache(cacheKey, "https://tiles.example/layer-b/2023");

    vi.advanceTimersByTime(CACHE_TTL_MS + 1);

    expect(hasKey(cacheKey)).toBe(false);
    expect(getCachedUrl(cacheKey)).toBeUndefined();
  });
});