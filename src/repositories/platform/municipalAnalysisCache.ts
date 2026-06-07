import "server-only";

import { getPanelLayerWithMunicipalAnalysis } from "@/repositories/platform/panelLayerRepository";
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

  return `public, max-age=${ttlSeconds}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_SECONDS}`;
}

function logCacheEvent(event: MunicipalAnalysisCacheResult["status"], panelLayerId: string) {
  if (process.env.NODE_ENV !== "development" || process.env.VITEST === "true") {
    return;
  }

  console.info(`[municipalAnalysis] cache ${event}: ${panelLayerId}`);
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
): Promise<MunicipalAnalysisCacheValue> {
  const layer = await getPanelLayerWithMunicipalAnalysis(panelLayerId);

  return {
    found: Boolean(layer),
    imageData: layer?.imageData ?? null,
  };
}

export async function getCachedMunicipalAnalysisImageData(
  panelLayerId: string,
): Promise<MunicipalAnalysisCacheResult> {
  const now = Date.now();
  const currentEntry = cache.get(panelLayerId);

  if (
    currentEntry?.value &&
    currentEntry.expiresAt > now
  ) {
    currentEntry.lastAccessedAt = now;
    logCacheEvent("hit", panelLayerId);

    return {
      ...currentEntry.value,
      status: "hit",
    };
  }

  if (currentEntry?.pending) {
    currentEntry.lastAccessedAt = now;
    logCacheEvent("deduped", panelLayerId);

    return {
      ...(await currentEntry.pending),
      status: "deduped",
    };
  }

  logCacheEvent("miss", panelLayerId);

  const pending = loadMunicipalAnalysis(panelLayerId);
  const entry: MunicipalAnalysisCacheEntry = {
    expiresAt: now + getMunicipalAnalysisCacheTtlSeconds() * 1000,
    lastAccessedAt: now,
    pending,
  };
  cache.set(panelLayerId, entry);
  enforceCacheLimit();

  try {
    const value = await pending;
    const completedAt = Date.now();

    cache.set(panelLayerId, {
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
    cache.delete(panelLayerId);

    if (process.env.NODE_ENV === "development" && process.env.VITEST !== "true") {
      console.warn(
        `[municipalAnalysis] cache load failed: ${panelLayerId}`,
        error,
      );
    }

    throw error;
  }
}

export function clearMunicipalAnalysisCacheForTests() {
  cache.clear();
}
