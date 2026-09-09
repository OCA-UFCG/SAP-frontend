import "server-only";

import citiesIndex from "@/data/citiesIndex.json";
import municipalAvailabilityIndex from "@/data/municipalAvailabilityIndex.json";
import {
  MUNICIPAL_REPORT_LAYERS,
  type MunicipalReportLayerConfig,
} from "@/config/municipalReport";
import type {
  MunicipalReportAnalysis,
  MunicipalReportData,
  MunicipalReportPeriodSnapshot,
} from "@/contracts/municipalReport";
import { getCachedMunicipalAnalysisImageData } from "@/repositories/platform/municipalAnalysisCache";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import {
  getMunicipalReportSeries,
  type MunicipalReportLocationSeries,
} from "@/repositories/platform/municipalReportSeriesRepository";
import { isCompactImageData } from "@/utils/imageData";
import { formatReportPeriod } from "@/utils/municipalReportNarrative";
import {
  resolveMunicipalLayerPeriod,
  resolveNearestReportPeriod,
  type MunicipalAvailabilityIndex,
} from "@/utils/municipalAvailability";
import {
  buildMunicipalReportSnapshot,
  buildMunicipalReportTimeSeries,
  getMunicipalReportClasses,
  resolveMunicipalReportSnapshot,
  stableMunicipalReportAlias,
  toMunicipalReportPresentation,
} from "@/utils/municipalReport";
import type { TimingObserver } from "@/utils/serverTiming";

export interface MunicipalReportServiceDependencies {
  layers?: readonly MunicipalReportLayerConfig[];
  analysisIds?: readonly string[];
  loadImageData?: typeof getCachedMunicipalAnalysisImageData;
  listPanelLayers?: typeof getPanelLayers;
  now?: () => Date;
  onTiming?: TimingObserver;
  availabilityIndex?: MunicipalAvailabilityIndex;
  loadReportSeries?: typeof getMunicipalReportSeries;
}

export class MunicipalReportNotFoundError extends Error {}

/** O relatório é montado em pt-BR; as variáveis de template acompanham. */
const REPORT_TEMPLATE_LOCALE = "pt-BR";

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
      alias: override?.alias ?? stableMunicipalReportAlias(layer.id),
      title: layer.name || override?.title || layer.id,
      order: layer.panelPosition ?? override?.order ?? index,
      periods: isCompactImageData(layer.imageData)
        ? Object.keys(layer.imageData.years)
        : undefined,
      presentation: override?.presentation,
      reportPresentation: toMunicipalReportPresentation(layer.reportConfig),
      reportSeriesConfig: layer.reportSeriesConfig,
      statisticsSource: layer.statisticsSource,
      baseImageData: isCompactImageData(layer.imageData)
        ? layer.imageData
        : undefined,
    };
  });
}

function createLimiter(maxConcurrent: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async <T>(operation: () => Promise<T>): Promise<T> => {
    if (active >= maxConcurrent)
      await new Promise<void>((resolve) => queue.push(resolve));
    active += 1;
    try {
      return await operation();
    } finally {
      active -= 1;
      queue.shift()?.();
    }
  };
}

const limitFallbackLoad = createLimiter(4);

function getCalendarYear(period: string) {
  return period.match(/^(\d{4})(?:-\d{2})?$/u)?.[1] ?? null;
}

function resolveCanonicalReportPeriod(
  period: string,
  sourcePeriods: readonly string[],
  spatialPeriods: readonly string[],
) {
  if (spatialPeriods.includes(period)) return period;

  const calendarYear = getCalendarYear(period);
  if (!calendarYear) return period;

  const sourceMatches = sourcePeriods.filter(
    (candidate) => getCalendarYear(candidate) === calendarYear,
  );
  const spatialMatches = spatialPeriods.filter(
    (candidate) => getCalendarYear(candidate) === calendarYear,
  );

  return sourceMatches.length === 1 && spatialMatches.length === 1
    ? spatialMatches[0]
    : period;
}

function normalizeReportSnapshotPeriods(
  snapshots: readonly MunicipalReportPeriodSnapshot[],
  spatialPeriods: readonly string[],
) {
  const sourcePeriods = snapshots.map(({ period }) => period);

  return snapshots.map((snapshot) => {
    const period = resolveCanonicalReportPeriod(
      snapshot.period,
      sourcePeriods,
      spatialPeriods,
    );

    return period === snapshot.period
      ? snapshot
      : { ...snapshot, period, label: period };
  });
}

function normalizeReportSnapshotPeriod(
  snapshot: MunicipalReportPeriodSnapshot | null,
  sourcePeriods: readonly string[],
  spatialPeriods: readonly string[],
) {
  if (!snapshot) return null;

  const period = resolveCanonicalReportPeriod(
    snapshot.period,
    sourcePeriods,
    spatialPeriods,
  );

  return period === snapshot.period
    ? snapshot
    : { ...snapshot, period, label: period };
}

function buildSeriesDataset(
  base: NonNullable<MunicipalReportLayerConfig["baseImageData"]>,
  municipalityCode: string,
  series: MunicipalReportLocationSeries,
) {
  return {
    ...base,
    years: Object.fromEntries(
      Object.entries(series).map(([period, entry]) => [
        period,
        {
          imageId: base.years[period]?.imageId ?? "",
          year: base.years[period]?.year ?? period,
          ...(typeof entry.valuesScale === "number"
            ? { valuesScale: entry.valuesScale }
            : {}),
          values: { [municipalityCode]: entry.values },
        },
      ]),
    ),
  };
}

async function loadReportSeriesData(
  config: MunicipalReportLayerConfig,
  municipalityCode: string,
  loadReportSeries: typeof getMunicipalReportSeries,
) {
  if (!config.reportSeriesConfig || !config.baseImageData) return null;
  const result = await loadReportSeries(
    config.panelLayerId,
    municipalityCode,
    config.reportSeriesConfig,
  );
  if (!result.municipality) return null;
  const dataset = buildSeriesDataset(
    config.baseImageData,
    municipalityCode,
    result.municipality,
  );
  return {
    dataset,
    timeSeries: buildMunicipalReportTimeSeries(dataset, municipalityCode),
  };
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
    ...(config.reportPresentation
      ? { presentation: config.reportPresentation }
      : {}),
  };
}

/**
 * O período que serve de semente para a leitura da série.
 *
 * Uma camada do catálogo não está no índice de disponibilidade, então o período
 * pedido chega aqui sem nenhuma resolução e é literalmente o que o formulário
 * mandou. Se a camada não publicou esse período, a leitura da semente devolve
 * `years: {}` e a série inteira se perde — mesmo com todos os outros períodos
 * disponíveis. Cair no último período publicado resolve isso sem escolher nada
 * pelo relatório: o período efetivo continua sendo decidido depois, por
 * `resolveMunicipalReportSnapshot`, sobre a série já montada.
 */
function resolveSeriesSeedPeriod(
  requestedPeriod: string,
  availablePeriods: readonly string[] | undefined,
) {
  if (!availablePeriods?.length) return requestedPeriod;
  if (availablePeriods.includes(requestedPeriod)) return requestedPeriod;

  return (
    resolveNearestReportPeriod(availablePeriods, requestedPeriod) ??
    requestedPeriod
  );
}

async function loadMunicipalTimeSeries(
  panelLayerId: string,
  municipalityCode: string,
  requestedEffectivePeriod: string,
  availablePeriods: readonly string[] | undefined,
  loadImageData: typeof getCachedMunicipalAnalysisImageData,
  // Só as camadas com fonte estatística no GEE recebem território: é ele que
  // liga a leitura no Earth Engine em `attachMunicipalAnalysisYearToPanelLayer`.
  // As legadas continuam pedindo a partição inteira do Contentful, inclusive
  // `anaseca` e `carbonoembrapa`, que têm registro estático no GEE mas cujo
  // relatório sempre veio do Contentful.
  locationKey?: string,
) {
  const effectivePeriod = locationKey
    ? resolveSeriesSeedPeriod(requestedEffectivePeriod, availablePeriods)
    : requestedEffectivePeriod;
  const seed = await limitFallbackLoad(() =>
    loadImageData(panelLayerId, effectivePeriod, locationKey),
  );

  // Annual/monthly partition requests are the same path used by Monitoramento.
  // Each response contains the lightweight dataset metadata plus municipal
  // values for one period, avoiding the full-layer Contentful aggregation.
  if (seed.found && seed.imageData && isCompactImageData(seed.imageData)) {
    const periodKeys = [
      ...(availablePeriods?.length
        ? availablePeriods
        : Object.keys(seed.imageData.years)),
    ].sort((left, right) => left.localeCompare(right));

    if (periodKeys.length > 0) {
      const datasets = await Promise.all(
        periodKeys.map(async (period) => {
          if (period === effectivePeriod) return seed.imageData;
          const result = await limitFallbackLoad(() =>
            loadImageData(panelLayerId, period, locationKey),
          );
          return result.found &&
            result.imageData &&
            isCompactImageData(result.imageData)
            ? result.imageData
            : null;
        }),
      );
      const timeSeries = datasets.flatMap((dataset, index) => {
        const period = periodKeys[index];
        if (!dataset || !period || !isCompactImageData(dataset)) return [];
        const snapshot = buildMunicipalReportSnapshot(
          dataset,
          municipalityCode,
          period,
        );
        return snapshot ? [snapshot] : [];
      });

      return { dataset: seed.imageData, timeSeries };
    }
  }

  // Compatibility fallback for an annual request against a monthly dataset
  // or environments that have not published partition metadata yet. Uma fonte
  // dinâmica não tem esse caminho: sem período não há o que pedir ao Earth
  // Engine, e a agregação do Contentful nunca teve os valores dessa camada.
  if (locationKey) return null;

  const complete = await limitFallbackLoad(() => loadImageData(panelLayerId));
  if (
    !complete.found ||
    !complete.imageData ||
    !isCompactImageData(complete.imageData)
  ) {
    return null;
  }
  return {
    dataset: complete.imageData,
    timeSeries: buildMunicipalReportTimeSeries(
      complete.imageData,
      municipalityCode,
    ),
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
  const loadReportSeries =
    dependencies.loadReportSeries ?? getMunicipalReportSeries;
  const availabilityIndex =
    dependencies.availabilityIndex ??
    (municipalAvailabilityIndex as MunicipalAvailabilityIndex);
  const requestedAnalysisIds = dependencies.analysisIds
    ? new Set(dependencies.analysisIds.map((id) => id.trim().toLowerCase()))
    : null;
  const requestedAnalysisOrder = dependencies.analysisIds
    ? new Map(
        dependencies.analysisIds.map((id, index) => [
          id.trim().toLowerCase(),
          index,
        ]),
      )
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
    .sort((a, b) => {
      if (requestedAnalysisOrder) {
        const leftOrder =
          requestedAnalysisOrder.get(a.panelLayerId.toLowerCase()) ??
          requestedAnalysisOrder.get(a.alias.toLowerCase());
        const rightOrder =
          requestedAnalysisOrder.get(b.panelLayerId.toLowerCase()) ??
          requestedAnalysisOrder.get(b.alias.toLowerCase());

        if (leftOrder != null && rightOrder != null) {
          return leftOrder - rightOrder;
        }
      }

      return a.order - b.order;
    });
  const analyses = await Promise.all(
    layers.map(async (config): Promise<MunicipalReportAnalysis> => {
      const analysisStartedAt = performance.now();
      try {
        const isIndexedLayer = availabilityIndex.layers.some(
          (layer) => layer.panelLayerId === config.panelLayerId,
        );
        const indexedPeriod = resolveMunicipalLayerPeriod(
          availabilityIndex,
          municipalityCode,
          config.panelLayerId,
          requestedPeriod,
        );
        if (isIndexedLayer && !indexedPeriod && !config.reportSeriesConfig) {
          return unavailable(config, requestedPeriod);
        }
        const effectivePeriod = indexedPeriod ?? requestedPeriod;
        let seriesData = null;
        try {
          seriesData = await loadReportSeriesData(
            config,
            municipalityCode,
            loadReportSeries,
          );
        } catch (error) {
          console.warn(
            `[municipalReport] Shard indisponível para ${config.panelLayerId}; usando municipalAnalysis.`,
            error,
          );
        }
        const temporalData =
          seriesData ??
          (await loadMunicipalTimeSeries(
            config.panelLayerId,
            municipalityCode,
            effectivePeriod,
            config.periods,
            loadImageData,
            config.statisticsSource ? municipalityCode : undefined,
          ));
        if (!temporalData) return unavailable(config, requestedPeriod);
        const { dataset, timeSeries: sourceTimeSeries } = temporalData;
        const sourceSnapshot = resolveMunicipalReportSnapshot(
          sourceTimeSeries,
          requestedPeriod,
        );
        const spatialPeriods = config.baseImageData
          ? Object.keys(config.baseImageData.years)
          : (config.periods ?? []);
        const sourcePeriods = sourceTimeSeries.map(({ period }) => period);
        const timeSeries = normalizeReportSnapshotPeriods(
          sourceTimeSeries,
          spatialPeriods,
        );
        const snapshot = normalizeReportSnapshotPeriod(
          sourceSnapshot,
          sourcePeriods,
          spatialPeriods,
        );
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
          ...(config.reportPresentation
            ? { presentation: config.reportPresentation }
            : {}),
        };
      } catch (error) {
        console.error(
          `[municipalReport] Falha ao carregar ${config.panelLayerId}:`,
          error,
        );
        return unavailable(config, requestedPeriod);
      } finally {
        dependencies.onTiming?.(
          `analysis_${stableMunicipalReportAlias(config.panelLayerId)}`,
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
    // O nome do índice existe para a frase escrita no catálogo poder citar a
    // fonte ("conforme o [indice]") sem que quem escreve repita o título à mão
    // — um texto genérico passa a valer para qualquer índice.
    templateVariables[`indice_${analysis.alias}`] = analysis.title;
    templateVariables[`classe_${analysis.alias}`] =
      analysis.snapshot?.dominantClass?.label ?? null;
    templateVariables[`percentual_${analysis.alias}`] = dominantValue;
    templateVariables[`valor_${analysis.alias}`] = dominantValue;
    templateVariables[`unidade_${analysis.alias}`] = analysis.unit || null;
    templateVariables[`valor_com_unidade_${analysis.alias}`] =
      dominantValue == null
        ? null
        : `${dominantValue.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}${analysis.unit ? ` ${analysis.unit}` : ""}`;
    templateVariables[`periodo_${analysis.alias}`] = analysis.effectivePeriod;
    // O período por extenso existe para o texto escrito no catálogo: "2024-09"
    // no meio de uma frase lê-se mal, e quem escreve não deve ter que formatar
    // data à mão para cada índice.
    templateVariables[`periodo_extenso_${analysis.alias}`] =
      analysis.effectivePeriod
        ? formatReportPeriod(analysis.effectivePeriod, REPORT_TEMPLATE_LOCALE)
        : null;
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
