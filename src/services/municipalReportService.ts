import "server-only";

import citiesIndex from "@/data/citiesIndex.json";
import {
  MUNICIPAL_REPORT_LAYERS,
  type MunicipalReportLayerConfig,
} from "@/config/municipalReport";
import type {
  MunicipalReportAnalysis,
  MunicipalReportData,
} from "@/contracts/municipalReport";
import { getCachedMunicipalAnalysisImageData } from "@/repositories/platform/municipalAnalysisCache";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { isCompactImageData } from "@/utils/imageData";
import {
  buildMunicipalReportSnapshot,
  buildMunicipalReportTimeSeries,
  getMunicipalReportClasses,
  resolveMunicipalReportSnapshot,
} from "@/utils/municipalReport";
import type { TimingObserver } from "@/utils/serverTiming";

export interface MunicipalReportServiceDependencies {
  layers?: readonly MunicipalReportLayerConfig[];
  analysisIds?: readonly string[];
  loadImageData?: typeof getCachedMunicipalAnalysisImageData;
  listPanelLayers?: typeof getPanelLayers;
  now?: () => Date;
  onTiming?: TimingObserver;
}

export class MunicipalReportNotFoundError extends Error {}

function stableAlias(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function resolveReportLayers(
  dependencies: MunicipalReportServiceDependencies,
) {
  if (dependencies.layers) return [...dependencies.layers];

  const panelLayers = await (dependencies.listPanelLayers ?? getPanelLayers)();
  const configured = new Map(
    MUNICIPAL_REPORT_LAYERS.map((layer) => [layer.panelLayerId, layer]),
  );
  return panelLayers.map((layer, index): MunicipalReportLayerConfig => {
    const override = configured.get(layer.id);
    return {
      panelLayerId: layer.id,
      alias: override?.alias ?? stableAlias(layer.id),
      title: layer.name || override?.title || layer.id,
      order: layer.panelPosition ?? override?.order ?? index,
      periods: isCompactImageData(layer.imageData)
        ? Object.keys(layer.imageData.years)
        : undefined,
      timeSeriesLocationKey: override?.timeSeriesLocationKey,
      presentation: override?.presentation,
    };
  });
}

function unavailable(
  config: MunicipalReportLayerConfig,
  period: string,
): MunicipalReportAnalysis {
  return {
    id: config.panelLayerId,
    alias: config.alias,
    title: config.title,
    unit: "%",
    valueType: "percentage",
    status: "unavailable",
    requestedPeriod: period,
    effectivePeriod: null,
    classes: [],
    snapshot: null,
    timeSeries: [],
  };
}

async function loadMunicipalTimeSeries(
  panelLayerId: string,
  municipalityCode: string,
  requestedPeriod: string,
  availablePeriods: readonly string[] | undefined,
  timeSeriesLocationKey: string,
  loadImageData: typeof getCachedMunicipalAnalysisImageData,
) {
  const seed = await loadImageData(panelLayerId, requestedPeriod);

  // Annual/monthly partition requests are the same path used by Monitoramento.
  // Each response contains the lightweight dataset metadata plus municipal
  // values for one period, avoiding the full-layer Contentful aggregation.
  if (seed.found && seed.imageData && isCompactImageData(seed.imageData)) {
    const periodKeys = [...(availablePeriods?.length
      ? availablePeriods
      : Object.keys(seed.imageData.years))].sort((left, right) =>
        left.localeCompare(right),
      );

    if (periodKeys.length > 0) {
      const datasets = await Promise.all(
        periodKeys.map(async (period) => {
          if (period === requestedPeriod) return seed.imageData;
          const result = await loadImageData(panelLayerId, period);
          return result.found && result.imageData && isCompactImageData(result.imageData)
            ? result.imageData
            : null;
        }),
      );
      const timeSeries = datasets.flatMap((dataset, index) => {
        const period = periodKeys[index];
        if (!dataset || !period || !isCompactImageData(dataset)) return [];
        const snapshot = buildMunicipalReportSnapshot(
          dataset,
          timeSeriesLocationKey,
          period,
        );
        return snapshot ? [snapshot] : [];
      });

      return { dataset: seed.imageData, timeSeries };
    }
  }

  // Compatibility fallback for an annual request against a monthly dataset
  // or environments that have not published partition metadata yet.
  const complete = await loadImageData(panelLayerId);
  if (!complete.found || !complete.imageData || !isCompactImageData(complete.imageData)) {
    return null;
  }
  return {
    dataset: complete.imageData,
    timeSeries: buildMunicipalReportTimeSeries(complete.imageData, timeSeriesLocationKey),
  };
}

export async function buildMunicipalReport(
  municipalityCode: string,
  requestedPeriod: string,
  dependencies: MunicipalReportServiceDependencies = {},
): Promise<MunicipalReportData> {
  const municipality = citiesIndex.find(
    (city) => city.code === municipalityCode,
  );
  if (!municipality)
    throw new MunicipalReportNotFoundError("Municipality not found.");

  const loadImageData =
    dependencies.loadImageData ?? getCachedMunicipalAnalysisImageData;
  const requestedAnalysisIds = dependencies.analysisIds
    ? new Set(dependencies.analysisIds.map((id) => id.trim().toLowerCase()))
    : null;
  const layersStartedAt = performance.now();
  const resolvedLayers = await resolveReportLayers(dependencies);
  dependencies.onTiming?.(
    "resolve_layers",
    performance.now() - layersStartedAt,
    "Listagem e resolução das camadas",
  );
  const layers = resolvedLayers
    .filter(
      (layer) =>
        !requestedAnalysisIds ||
        requestedAnalysisIds.has(layer.panelLayerId.toLowerCase()) ||
        requestedAnalysisIds.has(layer.alias.toLowerCase()),
    )
    .sort((a, b) => a.order - b.order);
  const analyses = await Promise.all(
    layers.map(async (config): Promise<MunicipalReportAnalysis> => {
      const analysisStartedAt = performance.now();
      try {
      const temporalData = await loadMunicipalTimeSeries(
        config.panelLayerId,
        municipalityCode,
        requestedPeriod,
        config.periods,
        config.timeSeriesLocationKey ?? municipalityCode,
        loadImageData,
      );
      if (!temporalData)
        return unavailable(config, requestedPeriod);
      const { dataset, timeSeries } = temporalData;
      const snapshot = config.timeSeriesLocationKey
        ? buildMunicipalReportSnapshot(dataset, municipalityCode, requestedPeriod)
        : resolveMunicipalReportSnapshot(timeSeries, requestedPeriod);
        return {
          id: config.panelLayerId,
          alias: config.alias,
          title: config.title,
          unit:
          dataset.valueConfig?.unit ??
          (dataset.valueConfig?.type === "absolute" ? "" : "%"),
        valueType: dataset.valueConfig?.type ?? "percentage",
          status: snapshot ? "available" : "period_not_found",
          requestedPeriod,
          effectivePeriod: snapshot?.period ?? null,
        classes: getMunicipalReportClasses(dataset),
          snapshot,
          timeSeries,
        };
      } catch (error) {
        console.error(
          `[municipalReport] Falha ao carregar ${config.panelLayerId}:`,
          error,
        );
        return unavailable(config, requestedPeriod);
      } finally {
        dependencies.onTiming?.(
          `analysis_${stableAlias(config.panelLayerId)}`,
          performance.now() - analysisStartedAt,
          config.title,
        );
      }
    }),
  );

  const templateVariables: MunicipalReportData["templateVariables"] = {
    municipio: municipality.name,
    uf: municipality.uf.toUpperCase(),
    codigoMunicipio: municipality.code,
  };
  for (const analysis of analyses) {
    const dominantValue = analysis.snapshot?.dominantClass?.percentage ?? null;
    templateVariables[`classe_${analysis.alias}`] =
      analysis.snapshot?.dominantClass?.label ?? null;
    templateVariables[`percentual_${analysis.alias}`] =
      dominantValue;
    templateVariables[`valor_${analysis.alias}`] = dominantValue;
    templateVariables[`unidade_${analysis.alias}`] = analysis.unit || null;
    templateVariables[`valor_com_unidade_${analysis.alias}`] = dominantValue == null
      ? null
      : `${dominantValue.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${analysis.unit ? ` ${analysis.unit}` : ""}`;
    templateVariables[`periodo_${analysis.alias}`] = analysis.effectivePeriod;
  }

  return {
    schemaVersion: 1,
    generatedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    requestedPeriod,
    municipality: {
      code: municipality.code,
      name: municipality.name,
      uf: municipality.uf.toUpperCase(),
    },
    analyses,
    templateVariables,
  };
}
