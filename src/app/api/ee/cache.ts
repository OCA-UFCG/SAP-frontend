import {
  DEFAULT_SPATIAL_SELECTION,
  type SpatialSelection,
} from "@/utils/spatialScope";

const CACHE_TTL_MS = 1000 * 60 * 30;
const CACHE_KEY_VERSION = "v8";
// O espaço de chaves é camada x período x recorte espacial (~500 períodos x ~40
// recortes). Cada entrada é só uma URL, então o teto existe para o mapa não
// crescer para sempre com chaves que ninguém pede de novo, não por memória.
const DEFAULT_MAX_ENTRIES = 5000;

interface CacheEntry {
  url: string;
  timestamp: number;
}

const cacheUrls = new Map<string, CacheEntry>();
// Uma promessa por chave em voo: sem isso, N requests simultâneos no mesmo miss
// viram N getMapId no Earth Engine.
const pendingUrls = new Map<string, Promise<string>>();

function getMaxEntries() {
  const value = Number(process.env.EE_URL_CACHE_MAX_ENTRIES);

  if (!Number.isFinite(value) || value <= 0) {
    return DEFAULT_MAX_ENTRIES;
  }

  return Math.floor(value);
}

function buildVisualizationSignature(
  imageId?: string,
  imageParams?: Array<unknown>,
  minScale?: number,
  maxScale?: number,
  mapVisualization?: unknown,
  imageCollectionSelection?: unknown,
) {
  return JSON.stringify({
    imageId: imageId ?? null,
    imageParams: imageParams ?? null,
    minScale: minScale ?? null,
    maxScale: maxScale ?? null,
    mapVisualization: mapVisualization ?? null,
    imageCollectionSelection: imageCollectionSelection ?? null,
  });
}

export const buildCacheKey = (
  name: string,
  year: string,
  imageId?: string,
  imageParams?: Array<unknown>,
  minScale?: number,
  maxScale?: number,
  mapVisualization?: unknown,
  spatialSelection: SpatialSelection = DEFAULT_SPATIAL_SELECTION,
  imageCollectionSelection?: unknown,
) =>
  `${CACHE_KEY_VERSION}:${name}:${year}:${buildVisualizationSignature(
    imageId,
    imageParams,
    minScale,
    maxScale,
    mapVisualization,
    imageCollectionSelection,
  )}:${spatialSelection.spatialArea}:${spatialSelection.spatialValue}`;

// Map preserva ordem de inserção: reinserir a chave lida deixa a menos
// recentemente usada sempre em primeiro lugar, o que torna a evicção O(1).
function markAsRecentlyUsed(key: string, entry: CacheEntry) {
  cacheUrls.delete(key);
  cacheUrls.set(key, entry);
}

function evictLeastRecentlyUsed() {
  const maxEntries = getMaxEntries();

  while (cacheUrls.size > maxEntries) {
    const { value: oldestKey } = cacheUrls.keys().next();

    if (oldestKey === undefined) {
      return;
    }

    cacheUrls.delete(oldestKey);
  }
}

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

  markAsRecentlyUsed(key, entry);
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
    markAsRecentlyUsed(key, { url, timestamp: Date.now() });
    evictLeastRecentlyUsed();
    return;
  }

  cacheUrls.delete(key);
};

/**
 * Resolve a URL de tiles de uma chave garantindo uma única ida ao Earth Engine
 * por chave em voo: requests simultâneos no mesmo miss compartilham a promessa
 * em vez de gerarem um `getMapId` cada um.
 *
 * const url = await getOrCreateCachedUrl(cacheKey, () =>
 *   getEarthEngineUrl(imageId, imageParams, minScale, maxScale, options),
 * );
 */
export function getOrCreateCachedUrl(
  key: string,
  loadUrl: () => Promise<string>,
): Promise<string> {
  const pending = pendingUrls.get(key);

  if (pending) {
    return pending;
  }

  const request = loadUrl()
    .then((url) => {
      addUrlToCache(key, url);
      return url;
    })
    .finally(() => {
      pendingUrls.delete(key);
    });

  pendingUrls.set(key, request);
  return request;
}

export const clearEarthEngineCacheForLayer = (layerId: string) => {
  const marker = `:${layerId}:`;
  for (const key of cacheUrls.keys()) {
    if (key.includes(marker)) {
      cacheUrls.delete(key);
    }
  }
  // Uma publicação do catálogo troca a configuração da camada. Descartar a
  // promessa em voo faz o próximo request carregar a configuração nova em vez de
  // aguardar a antiga; a chave já em voo continua sendo a da configuração
  // anterior, que ninguém mais pede porque a assinatura entra na chave.
  for (const key of pendingUrls.keys()) {
    if (key.includes(marker)) {
      pendingUrls.delete(key);
    }
  }
};

export { CACHE_TTL_MS };
