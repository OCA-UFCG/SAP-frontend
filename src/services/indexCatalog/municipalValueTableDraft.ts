import "server-only";

import type { GeeMunicipalValueTableStatisticsSource } from "@/contracts/geeMunicipalValueTable";
import type { PublishedGeeMunicipalValueTableSource } from "@/contracts/geeStatistics";
import { hashCatalogValue } from "@/services/indexCatalog/catalogFingerprint";
import { validateMapAssets } from "@/services/indexCatalog/mapAssetValidation";
import { discoverMunicipalValueTable } from "@/services/indexCatalog/municipalValueTableBuild";
import type {
  CatalogValidationReport,
  ClassMapping,
  IndexCatalogBuildResult,
  IndexCatalogConfigV2,
  MunicipalValueIndicator,
} from "@/types/indexCatalog";
import type {
  CompactAnalysisTemplates,
  CompactMapVisualizationConfig,
} from "@/utils/analysis";
import { measurementUnitSuffix } from "@/utils/analysisValue";
import { expandAssetForPeriod, inferTimeScale } from "@/utils/indexCatalog";

/**
 * As frases do painel para um indicador de valor único.
 *
 * São geradas do rótulo e da unidade em vez de virarem quatro campos no
 * formulário: o operador do catálogo já descreveu o indicador uma vez, e cada
 * campo a mais é uma frase a mais para manter coerente entre os índices.
 *
 * @example
 * buildValueTemplates({ label: "Registros de secas", measurementUnit: "registros", ... });
 * // { country: "Registros de secas no {name}: {value} registros.", ... }
 */
export function buildValueTemplates(
  indicator: MunicipalValueIndicator,
): CompactAnalysisTemplates {
  const suffix = measurementUnitSuffix(indicator.measurementUnit);
  return {
    country: `${indicator.label} no {name}: {value}${suffix}.`,
    state: `${indicator.label} em {name}: {value}${suffix}.`,
    municipality: `${indicator.label} em {name}: {value}${suffix}.`,
    highlight: indicator.label,
  };
}

/**
 * As faixas de cor do mapa, com o valor de pixel que a classificação por limites
 * produz.
 *
 * `classifyValueByThresholds` devolve `min + posição`, então as faixas ocupam
 * `0..n-1` e a paleta cai exatamente sobre elas.
 */
export function buildRangeClasses(configured: ClassMapping[]): ClassMapping[] {
  return configured.map((entry, position) => ({
    ...entry,
    classIndex: position,
    pixelValue: position,
  }));
}

function buildValueMapVisualization(
  config: IndexCatalogConfigV2,
  ranges: ClassMapping[],
  thresholds: number[],
): CompactMapVisualizationConfig {
  return {
    sourceType: "featureCollection",
    ...(config.earthEngine.property
      ? { property: config.earthEngine.property }
      : {}),
    min: 0,
    max: ranges.length - 1,
    palette: ranges.map((range) => range.color),
    legend: ranges.map((range, position) => ({
      id: range.id,
      label: range.label,
      color: range.color,
      pixelLimit: position,
    })),
    thresholds,
    outline: { color: "#000000", width: 0.5, opacity: 1 },
  };
}

export function requireIndicator(
  config: IndexCatalogConfigV2,
): MunicipalValueIndicator {
  if (!config.valueIndicator) {
    throw new Error("Descreva o indicador do índice de valor único.");
  }
  return config.valueIndicator;
}

/**
 * O mapa de um índice de valor único é desenhado a partir da própria tabela:
 * `buildValueMapVisualization` grava `sourceType: "featureCollection"` e não
 * usa banda. Sem esta recusa a validação aprovaria um raster — ela confere o
 * asset contra o que o formulário diz —, e o índice publicado tentaria ler esse
 * raster como tabela, devolvendo um mapa em branco.
 */
function requireFeatureCollectionMap(config: IndexCatalogConfigV2) {
  if (config.earthEngine.sourceType !== "featureCollection") {
    throw new Error(
      `O mapa de um índice de valor único por município sai da própria FeatureCollection, mas o formulário informa ${config.earthEngine.sourceType}. Escolha FeatureCollection em "Visualização do mapa".`,
    );
  }
}

export function requireThresholds(
  config: IndexCatalogConfigV2,
  rangeCount: number,
) {
  const thresholds = config.earthEngine.thresholds ?? [];
  if (thresholds.length !== rangeCount - 1) {
    throw new Error(
      `Informe exatamente ${rangeCount - 1} limite(s) para separar as ${rangeCount} faixas de cor do mapa.`,
    );
  }
  return thresholds;
}

/**
 * A prévia de um índice cuja tabela traz um valor por município.
 *
 * A mesma FeatureCollection costuma ser a estatística e o asset do mapa — é como
 * chegam os dados socioeconômicos —, mas as duas coisas continuam validadas
 * separadamente: a estatística pelas colunas de período e o mapa pelo tipo do
 * asset e pela propriedade desenhada.
 */
export async function buildMunicipalValueTableDraft(
  config: IndexCatalogConfigV2,
  source: GeeMunicipalValueTableStatisticsSource,
): Promise<IndexCatalogBuildResult> {
  const indicator = requireIndicator(config);
  requireFeatureCollectionMap(config);
  const ranges = buildRangeClasses(config.classes);
  const thresholds = requireThresholds(config, ranges.length);
  const discovery = await discoverMunicipalValueTable(source);
  const mapAssets = await validateMapAssets(config, discovery.periods);

  const sourceRevision = hashCatalogValue({
    source,
    assets: discovery.assets.map(({ assetId, updateTime, columns }) => ({
      assetId,
      updateTime,
      columns,
    })),
    periods: discovery.periods,
  });
  const statisticsSource: PublishedGeeMunicipalValueTableSource = {
    ...source,
    schemaVersion: 1,
    sourceRevision,
  };
  const mapVisualization = buildValueMapVisualization(
    config,
    ranges,
    thresholds,
  );
  const panelLayerImageData = {
    schemaVersion: 1,
    type: "territorial-compact" as const,
    defaultYear: discovery.periods.at(-1),
    // Uma classe só: o painel mostra o valor do indicador, e as faixas coloridas
    // pertencem à legenda do mapa.
    classes: [
      {
        id: config.panelLayerId,
        label: indicator.label,
        color: indicator.color,
      },
    ],
    locations: { br: "Brasil" },
    templates: buildValueTemplates(indicator),
    ranking: {
      title: `Estados por ${indicator.label.toLocaleLowerCase("pt-BR")}`,
      totalLabel: "Estados",
    },
    valueConfig: {
      type: indicator.valueType,
      unit: indicator.measurementUnit,
      distributionTitle: indicator.label,
    },
    mapVisualization,
    years: Object.fromEntries(
      discovery.periods.map((period) => [
        period,
        {
          imageId: expandAssetForPeriod(config.earthEngine, period),
          valuesScale: 1,
          values: {},
        },
      ]),
    ),
  };

  const validation: CatalogValidationReport = {
    validatedAt: new Date().toISOString(),
    valid: true,
    errors: [],
    warnings: [
      {
        code: "aggregate_scopes_unavailable",
        message: `A tabela traz ${discovery.municipalityCount} municípios e o painel deriva Brasil e UFs por ${source.aggregation === "sum" ? "soma" : "média"}. Recortes de região, bioma, ASD e semiárido ficam sem valor: eles não saem de uma tabela municipal.`,
      },
    ],
    inferred: {
      panelLayerId: config.panelLayerId,
      periods: discovery.periods,
      defaultPeriod: discovery.periods.at(-1),
      timeScale: inferTimeScale(discovery.periods),
      classIndexes: ranges.map((range) => range.classIndex),
      statisticsAssetCount: discovery.assets.length,
      imageDataBytes: Buffer.byteLength(JSON.stringify(panelLayerImageData)),
    },
    sourceFingerprint: hashCatalogValue({
      sourceRevision,
      mapAssets,
      classes: ranges,
      indicator,
      earthEngine: config.earthEngine,
      periods: discovery.periods,
    }),
  };

  return {
    panelLayerImageData,
    validation,
    mapVisualization,
    statisticsSource,
    classes: ranges,
  };
}
