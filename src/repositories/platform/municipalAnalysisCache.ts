import "server-only";

import {
  getPanelLayerWithMunicipalAnalysis,
  getPanelLayerWithMunicipalAnalysisYear,
} from "@/repositories/platform/panelLayerRepository";
import type { PanelLayerI } from "@/utils/interfaces";

const DEFAULT_CACHE_TTL_SECONDS = 600;
const DEFAULT_CACHE_MAX_ENTRIES = 20;
const STALE_WHILE_REVALIDATE_SECONDS = 3600;

interface MunicipalAnalysisCacheValue {
  found: boolean;
  imageData: PanelLayerI["imageData"] | null;
}

interface MunicipalAnalysisCacheEntry {
  expiresAt: number;
  lastAccessedAt: number;
  value?: MunicipalAnalysisCacheValue;
  pending?: Promise<MunicipalAnalysisCacheValue>;
}

interface MunicipalAnalysisCacheResult extends MunicipalAnalysisCacheValue {
  status: "hit" | "miss" | "deduped";
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

function enforceCacheLimit() {
  const maxEntries = getMunicipalAnalysisCacheMaxEntries();

  while (cache.size > maxEntries) {
    const [oldestKey] = [...cache.entries()].sort(
      ([, left], [, right]) => left.lastAccessedAt - right.lastAccessedAt,
    )[0] ?? [undefined];

    if (!oldestKey) {
      return;
    }

    cache.delete(oldestKey);
  }
}

async function loadMunicipalAnalysis(
  panelLayerId: string,
  yearKey?: string,
): Promise<MunicipalAnalysisCacheValue> {
  const layer = yearKey
    ? await getPanelLayerWithMunicipalAnalysisYear(panelLayerId, yearKey)
    : await getPanelLayerWithMunicipalAnalysis(panelLayerId);

  return {
    found: Boolean(layer),
    imageData: layer?.imageData ?? null,
  };
}

function getCacheKey(panelLayerId: string, yearKey?: string): string {
  return yearKey ? `${panelLayerId}::${yearKey}` : panelLayerId;
}

export async function getCachedMunicipalAnalysisImageData(
  panelLayerId: string,
  yearKey?: string,
): Promise<MunicipalAnalysisCacheResult> {
  const now = Date.now();
  const cacheKey = getCacheKey(panelLayerId, yearKey);
  const currentEntry = cache.get(cacheKey);

  if (currentEntry?.value && currentEntry.expiresAt > now) {
    currentEntry.lastAccessedAt = now;
    logCacheEvent("hit", cacheKey);

    return {
      ...currentEntry.value,
      status: "hit",
    };
  }

  if (currentEntry?.pending) {
    currentEntry.lastAccessedAt = now;
    logCacheEvent("deduped", cacheKey);

    return {
      ...(await currentEntry.pending),
      status: "deduped",
    };
  }

  logCacheEvent("miss", cacheKey);

  const pending = loadMunicipalAnalysis(panelLayerId, yearKey);
  const entry: MunicipalAnalysisCacheEntry = {
    expiresAt: now + getMunicipalAnalysisCacheTtlSeconds() * 1000,
    lastAccessedAt: now,
    pending,
  };
  cache.set(cacheKey, entry);
  enforceCacheLimit();

  try {
    const value = await pending;
    const completedAt = Date.now();

    cache.set(cacheKey, {
      expiresAt: completedAt + getMunicipalAnalysisCacheTtlSeconds() * 1000,
      lastAccessedAt: completedAt,
      value,
    });
    enforceCacheLimit();

    return {
      ...value,
      status: "miss",
    };
  } catch (error) {
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
