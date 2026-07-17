import "server-only";

import type { MunicipalReportData } from "@/contracts/municipalReport";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import {
  buildMunicipalReport,
  type MunicipalReportServiceDependencies,
} from "@/services/municipalReportService";

const TTL_MS = 600_000;
const MAX_REPORTS = 10;

interface CacheEntry {
  expiresAt: number;
  lastAccessedAt: number;
  value?: MunicipalReportData;
  pending?: Promise<MunicipalReportData>;
}

const cache = new Map<string, CacheEntry>();

function trimCache() {
  while (cache.size > MAX_REPORTS) {
    const oldest = [...cache.entries()].sort(
      ([, left], [, right]) => left.lastAccessedAt - right.lastAccessedAt,
    )[0]?.[0];
    if (!oldest) return;
    cache.delete(oldest);
  }
}

export async function buildCachedMunicipalReport(
  municipalityCode: string,
  requestedPeriod: string,
  dependencies: Pick<MunicipalReportServiceDependencies, "analysisIds" | "onTiming"> = {},
): Promise<MunicipalReportData> {
  const panelLayers = await getPanelLayers();
  const selected = dependencies.analysisIds?.length
    ? new Set(dependencies.analysisIds.map((id) => id.toLowerCase()))
    : null;
  const versions = panelLayers
    .filter((layer) => !selected || selected.has(layer.id.toLowerCase()))
    .map((layer) => `${layer.id}@${layer.reportSeriesConfig?.datasetVersion ?? "legacy"}`)
    .sort();
  const requestedIds = [...(dependencies.analysisIds ?? [])]
    .map((id) => id.toLowerCase())
    .join(",");
  const key = [municipalityCode, requestedPeriod, requestedIds, versions.join(",")].join("::");
  const now = Date.now();
  const current = cache.get(key);

  if (current?.value && current.expiresAt > now) {
    current.lastAccessedAt = now;
    dependencies.onTiming?.("report_cache", 0, "Cache do relatório: hit");
    return current.value;
  }
  if (current?.pending) {
    current.lastAccessedAt = now;
    dependencies.onTiming?.("report_cache", 0, "Cache do relatório: deduplicado");
    return current.pending;
  }

  const pending = buildMunicipalReport(municipalityCode, requestedPeriod, {
    ...dependencies,
    listPanelLayers: async () => panelLayers,
  });
  cache.set(key, { expiresAt: now + TTL_MS, lastAccessedAt: now, pending });
  trimCache();

  try {
    const value = await pending;
    const completedAt = Date.now();
    cache.set(key, {
      expiresAt: completedAt + TTL_MS,
      lastAccessedAt: completedAt,
      value,
    });
    return value;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

export function clearMunicipalReportCache() {
  cache.clear();
}
