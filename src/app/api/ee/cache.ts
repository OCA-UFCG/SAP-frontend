const CACHE_TTL_MS = 1000 * 60 * 30;
const CACHE_KEY_VERSION = "v2";

interface CacheEntry {
  url: string;
  timestamp: number;
}

const cacheUrls = new Map<string, CacheEntry>();

export const buildCacheKey = (name: string, year: string) =>
  `${CACHE_KEY_VERSION}:${name}:${year}`;

export const hasKey = (key: string) => {
  const entry = cacheUrls.get(key);
  if (!entry) {
    return false;
  }

  const expired = Date.now() - entry.timestamp > CACHE_TTL_MS;
  if (expired) {
    cacheUrls.delete(key);
  }

  return !expired;
};

export const getCachedUrl = (key: string) => {
  return cacheUrls.get(key)?.url || undefined;
};

export const removeCacheUrl = (key: string) => cacheUrls.delete(key);

export const addUrlToCache = (key: string, url: string | null) => {
  if (url) {
    cacheUrls.set(key, { url, timestamp: Date.now() });
    return;
  }

  cacheUrls.delete(key);
};

export { CACHE_TTL_MS };