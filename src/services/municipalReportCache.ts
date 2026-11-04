import "server-only";

import { REPORT_DEFAULT_PERIOD } from "@/config/municipalReport";
import type { MunicipalReportData } from "@/contracts/municipalReport";
import { getStatisticsRowsGeneration } from "@/repositories/platform/geeStatisticsRowsCache";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import type { PanelLayerI } from "@/utils/interfaces";
import {
  buildMunicipalReport,
  type MunicipalReportServiceDependencies,
} from "@/services/municipalReportService";
import {
  getSpatialScopeLocationKey,
  SPATIAL_VALUE_OPTIONS,
  type SpatialArea,
  type SpatialSelection,
} from "@/utils/spatialScope";
import { MUNICIPALITY_KEY_PATTERN } from "@/utils/statisticsLocationScope";

type ReportDependencies = Pick<MunicipalReportServiceDependencies, "analysisIds" | "onTiming">;

const AGGREGATE_REPORT_KEYS = (
  Object.keys(SPATIAL_VALUE_OPTIONS) as SpatialArea[]
).flatMap((spatialArea) =>
  SPATIAL_VALUE_OPTIONS[spatialArea].flatMap(
    ({ value }) =>
      getSpatialScopeLocationKey({ spatialArea, spatialValue: value } as SpatialSelection) ?? [],
  ),
);

const TTL_MS = 1_200_000;
// Um relatório municipal completo ocupa ~430 KiB (as 21 camadas com a série
// inteira de cada uma), então o teto é o que se aceita gastar de heap: 100
// entradas são ~43 MiB no pior caso. Dez entradas, o valor anterior, cabiam em
// menos de um minuto de navegação — dois usuários pulando entre municípios já
// expulsavam o relatório um do outro antes do TTL, e cada expulsão custa os
// ~18 s de remontagem.
const DEFAULT_MAX_REPORTS = 100;

interface CacheEntry {
  expiresAt: number;
  value?: MunicipalReportData;
  pending?: Promise<MunicipalReportData>;
}

const shared = globalThis as typeof globalThis & {
  __municipalReportCache?: Map<string, CacheEntry>;
};
const cache = (shared.__municipalReportCache ??= new Map<string, CacheEntry>());

function getMaxReports() {
  const value = Number(process.env.MUNICIPAL_REPORT_CACHE_MAX_ENTRIES);
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_MAX_REPORTS;
  return Math.floor(value);
}

// Map preserva ordem de inserção: reinserir a chave lida deixa a menos
// recentemente usada em primeiro lugar, e a evicção passa a ser O(1). A versão
// anterior ordenava o cache inteiro a cada inserção, o que encarecia justamente
// o teto maior que este arquivo agora permite.
function markAsRecentlyUsed(key: string, entry: CacheEntry) {
  cache.delete(key);
  cache.set(key, entry);
}

function trimCache() {
  const maxReports = getMaxReports();
  while (cache.size > maxReports) {
    const { value: oldestKey } = cache.keys().next();
    if (oldestKey === undefined) return;
    cache.delete(oldestKey);
  }
}

/**
 * A identidade dos dados de uma camada dentro da chave do cache.
 *
 * Um índice publicado pelo catálogo não tem `reportSeriesConfig`, então antes
 * ele entrava na chave como a constante `"legacy"` e republicar com outras
 * classes, outros períodos ou outra tabela estatística devolvia o relatório
 * anterior. `sourceRevision` é recalculado a cada revalidação do catálogo
 * (assets, períodos e índices de classe entram no hash), então é ele que
 * descreve a versão dos dados de uma camada v2.
 */
function resolveLayerDataVersion(layer: PanelLayerI): string {
  return (
    layer.statisticsSource?.sourceRevision ??
    layer.reportSeriesConfig?.datasetVersion ??
    "legacy"
  );
}

function selectAnalyses(
  report: MunicipalReportData,
  analysisIds: readonly string[] | undefined,
): MunicipalReportData {
  if (!analysisIds?.length) return report;
  const order = new Map(analysisIds.map((id, index) => [id.trim().toLowerCase(), index]));
  const rank = (analysis: MunicipalReportData["analyses"][number]) =>
    order.get(analysis.id.toLowerCase()) ?? order.get(analysis.alias.toLowerCase());
  const analyses = report.analyses
    .filter((analysis) => rank(analysis) !== undefined)
    .sort((left, right) => rank(left)! - rank(right)!);
  return { ...report, analyses };
}

export async function buildCachedMunicipalReport(
  locationKey: string,
  requestedPeriod: string,
  dependencies: ReportDependencies = {},
): Promise<MunicipalReportData> {
  if (MUNICIPALITY_KEY_PATTERN.test(locationKey)) {
    return loadCachedReport(locationKey, requestedPeriod, dependencies);
  }
  const { analysisIds, ...rest } = dependencies;
  const report = await loadCachedReport(locationKey, requestedPeriod, rest);
  return selectAnalyses(report, analysisIds);
}

export async function warmAggregateReports(): Promise<number> {
  let warmed = 0;
  for (const locationKey of AGGREGATE_REPORT_KEYS) {
    try {
      await buildCachedMunicipalReport(locationKey, REPORT_DEFAULT_PERIOD);
      warmed += 1;
    } catch (error) {
      console.warn(`[municipalReport] falha ao aquecer o relatório de ${locationKey}.`, error);
    }
  }
  return warmed;
}

async function loadCachedReport(
  locationKey: string,
  requestedPeriod: string,
  dependencies: ReportDependencies,
): Promise<MunicipalReportData> {
  const panelLayers = await getPanelLayers();
  const selected = dependencies.analysisIds?.length
    ? new Set(dependencies.analysisIds.map((id) => id.toLowerCase()))
    : null;
  const versions = panelLayers
    .filter((layer) => !selected || selected.has(layer.id.toLowerCase()))
    .map((layer) => `${layer.id}@${resolveLayerDataVersion(layer)}`)
    .sort();
  const requestedIds = [...(dependencies.analysisIds ?? [])]
    .map((id) => id.toLowerCase())
    .join(",");
  const key = [
    locationKey,
    requestedPeriod,
    requestedIds,
    versions.join(","),
    getStatisticsRowsGeneration(),
  ].join("::");
  const now = Date.now();
  const current = cache.get(key);

  if (current?.value && current.expiresAt > now) {
    markAsRecentlyUsed(key, current);
    dependencies.onTiming?.("report_cache", 0, "Cache do relatório: hit");
    return current.value;
  }
  if (current?.pending) {
    markAsRecentlyUsed(key, current);
    dependencies.onTiming?.("report_cache", 0, "Cache do relatório: deduplicado");
    return current.pending;
  }

  const pending = buildMunicipalReport(locationKey, requestedPeriod, {
    ...dependencies,
    listPanelLayers: async () => panelLayers,
  });
  markAsRecentlyUsed(key, { expiresAt: now + TTL_MS, pending });
  trimCache();

  try {
    const value = await pending;
    const completedAt = Date.now();
    markAsRecentlyUsed(key, {
      expiresAt: completedAt + TTL_MS,
      value,
    });
    trimCache();
    return value;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

export function clearMunicipalReportCache() {
  cache.clear();
}
