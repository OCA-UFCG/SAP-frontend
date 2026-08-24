import "server-only";

import {
  getPanelLayerWithMunicipalAnalysis,
  getPanelLayerWithMunicipalAnalysisYear,
} from "@/repositories/platform/panelLayerRepository";
import type { PanelLayerI } from "@/utils/interfaces";

const DEFAULT_CACHE_TTL_SECONDS = 600;
const DEFAULT_CACHE_MAX_ENTRIES = 200;
const STALE_WHILE_REVALIDATE_SECONDS = 3600;

interface MunicipalAnalysisCacheValue {
  found: boolean;
  imageData: PanelLayerI["imageData"] | null;
}

interface MunicipalAnalysisCacheEntry {
  expiresAt: number;
  value?: MunicipalAnalysisCacheValue;
  pending?: Promise<MunicipalAnalysisCacheValue>;
}

interface MunicipalAnalysisCacheResult extends MunicipalAnalysisCacheValue {
  status: "hit" | "miss" | "deduped" | "stale";
}

const cache = new Map<string, MunicipalAnalysisCacheEntry>();

function readPositiveIntegerEnv(key: string, fallback: number): number {
  const value = Number(process.env[key]);

  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

export function getMunicipalAnalysisCacheTtlSeconds(): number {
  return readPositiveIntegerEnv(
    "MUNICIPAL_ANALYSIS_CACHE_TTL_SECONDS",
    DEFAULT_CACHE_TTL_SECONDS,
  );
}

function getMunicipalAnalysisCacheMaxEntries(): number {
  return readPositiveIntegerEnv(
    "MUNICIPAL_ANALYSIS_CACHE_MAX_ENTRIES",
    DEFAULT_CACHE_MAX_ENTRIES,
  );
}

export function getMunicipalAnalysisCacheControlHeader(): string {
  const ttlSeconds = getMunicipalAnalysisCacheTtlSeconds();

  return `private, max-age=${ttlSeconds}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`;
}

function logCacheEvent(
  event: MunicipalAnalysisCacheResult["status"],
  cacheKey: string,
) {
  if (process.env.NODE_ENV !== "development" || process.env.VITEST === "true") {
    return;
  }

  console.info(`[municipalAnalysis] cache ${event}: ${cacheKey}`);
}

// Map preserva ordem de inserção: reinserir a chave acessada deixa a menos
// recentemente usada sempre em primeiro lugar. Antes a evicção ordenava o cache
// inteiro a cada miss (O(n log n)), o que tornava o teto de
// MUNICIPAL_ANALYSIS_CACHE_MAX_ENTRIES caro justamente quando aumentado: medido
// em 0,05 ms/miss com 200 entradas contra 1,7 ms/miss com 20.000.
function markAsRecentlyUsed(
  cacheKey: string,
  entry: MunicipalAnalysisCacheEntry,
) {
  cache.delete(cacheKey);
  cache.set(cacheKey, entry);
}

function enforceCacheLimit() {
  const maxEntries = getMunicipalAnalysisCacheMaxEntries();

  while (cache.size > maxEntries) {
    const { value: oldestKey } = cache.keys().next();

    if (oldestKey === undefined) {
      return;
    }

    cache.delete(oldestKey);
  }
}

async function loadMunicipalAnalysis(
  panelLayerId: string,
  yearKey?: string,
  locationKey?: string,
): Promise<MunicipalAnalysisCacheValue> {
  const layer = yearKey
    ? locationKey
      ? await getPanelLayerWithMunicipalAnalysisYear(
          panelLayerId,
          yearKey,
          locationKey,
        )
      : await getPanelLayerWithMunicipalAnalysisYear(panelLayerId, yearKey)
    : await getPanelLayerWithMunicipalAnalysis(panelLayerId);

  return {
    found: Boolean(layer),
    imageData: layer?.imageData ?? null,
  };
}

function getCacheKey(
  panelLayerId: string,
  yearKey?: string,
  locationKey?: string,
): string {
  return [panelLayerId, yearKey, locationKey].filter(Boolean).join("::");
}

export async function getCachedMunicipalAnalysisImageData(
  panelLayerId: string,
  yearKey?: string,
  locationKey?: string,
): Promise<MunicipalAnalysisCacheResult> {
  const now = Date.now();
  const cacheKey = getCacheKey(panelLayerId, yearKey, locationKey);
  const currentEntry = cache.get(cacheKey);

  if (currentEntry?.value && currentEntry.expiresAt > now) {
    markAsRecentlyUsed(cacheKey, currentEntry);
    logCacheEvent("hit", cacheKey);

    return {
      ...currentEntry.value,
      status: "hit",
    };
  }

  if (currentEntry?.pending) {
    markAsRecentlyUsed(cacheKey, currentEntry);
    logCacheEvent("deduped", cacheKey);

    return {
      ...(await currentEntry.pending),
      status: "deduped",
    };
  }

  logCacheEvent("miss", cacheKey);

  const pending = loadMunicipalAnalysis(panelLayerId, yearKey, locationKey);
  const entry: MunicipalAnalysisCacheEntry = {
    expiresAt: now + getMunicipalAnalysisCacheTtlSeconds() * 1000,
    pending,
  };
  markAsRecentlyUsed(cacheKey, entry);
  enforceCacheLimit();

  try {
    const value = await pending;
    const completedAt = Date.now();

    markAsRecentlyUsed(cacheKey, {
      expiresAt: completedAt + getMunicipalAnalysisCacheTtlSeconds() * 1000,
      value,
    });
    enforceCacheLimit();

    return {
      ...value,
      status: "miss",
    };
  } catch (error) {
    if (currentEntry?.value) {
      const failedAt = Date.now();

      markAsRecentlyUsed(cacheKey, {
        expiresAt: failedAt,
        value: currentEntry.value,
      });

      if (
        process.env.NODE_ENV === "development" &&
        process.env.VITEST !== "true"
      ) {
        console.warn(
          `[municipalAnalysis] cache refresh failed; serving stale value: ${cacheKey}`,
          error,
        );
      }

      return {
        ...currentEntry.value,
        status: "stale",
      };
    }

    cache.delete(cacheKey);

    if (
      process.env.NODE_ENV === "development" &&
      process.env.VITEST !== "true"
    ) {
      console.warn(`[municipalAnalysis] cache load failed: ${cacheKey}`, error);
    }

    throw error;
  }
}

export function clearMunicipalAnalysisCacheForTests() {
  cache.clear();
}

export function clearMunicipalAnalysisCache(panelLayerId?: string) {
  if (!panelLayerId) {
    cache.clear();
    return;
  }

  for (const cacheKey of cache.keys()) {
    if (cacheKey === panelLayerId || cacheKey.startsWith(`${panelLayerId}::`)) {
      cache.delete(cacheKey);
    }
  }
}
