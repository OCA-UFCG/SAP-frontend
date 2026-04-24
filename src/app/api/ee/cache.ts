const CACHE_TTL_MS = 1000 * 60 * 30;
const CACHE_KEY_VERSION = "v3";

interface CacheEntry {
  url: string;
  timestamp: number;
}

const cacheUrls = new Map<string, CacheEntry>();

function buildVisualizationSignature(
  imageId?: string,
  imageParams?: Array<unknown>,
  minScale?: number,
  maxScale?: number,
) {
  return JSON.stringify({
    imageId: imageId ?? null,
    imageParams: imageParams ?? null,
    minScale: minScale ?? null,
    maxScale: maxScale ?? null,
  });
}

export const buildCacheKey = (
  name: string,
  year: string,
  imageId?: string,
  imageParams?: Array<unknown>,
  minScale?: number,
  maxScale?: number,
) =>
  `${CACHE_KEY_VERSION}:${name}:${year}:${buildVisualizationSignature(
    imageId,
    imageParams,
    minScale,
    maxScale,
  )}`;

function getFreshEntry(key: string): CacheEntry | null {
  const entry = cacheUrls.get(key);
  if (!entry) {
    return null;
  }

  const expired = Date.now() - entry.timestamp > CACHE_TTL_MS;
  if (expired) {
    cacheUrls.delete(key);
    return null;
  }

  return entry;
}

export const hasKey = (key: string) => {
  return Boolean(getFreshEntry(key));
};

export const getCachedUrl = (key: string) => {
  return getFreshEntry(key)?.url;
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
