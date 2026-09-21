import "server-only";

import {
  isMunicipalSpreadsheetSource,
  type MunicipalSpreadsheetStatisticsSource,
  type MunicipalSpreadsheetSnapshotRef,
} from "@/contracts/municipalSpreadsheet";
import type { PublishedMunicipalSpreadsheetSource } from "@/contracts/geeStatistics";
import { hashCatalogValue } from "@/services/indexCatalog/catalogFingerprint";
import { rememberDraftSpreadsheetSnapshot } from "@/services/indexCatalog/draftSpreadsheetSnapshot";
import {
  readSpreadsheetSnapshot,
  type SpreadsheetSnapshotReaderDependencies,
} from "@/services/indexCatalog/spreadsheetSnapshotReader";
import type {
  CatalogValidationReport,
  ClassMapping,
  IndexCatalogBuildResult,
  IndexCatalogConfigV2,
  MunicipalValueIndicator,
} from "@/types/indexCatalog";
import type { CompactMapVisualizationConfig } from "@/utils/analysis";
import { inferTimeScale } from "@/utils/indexCatalog";
import {
  buildRangeClasses,
  buildValueTemplates,
  requireValueThresholds,
} from "@/utils/municipalValueIndicator";

export type SpreadsheetIndexDraftDependencies =
  SpreadsheetSnapshotReaderDependencies;

/**
 * O mapa de um índice de planilha é pintado no navegador sobre os tiles de
 * município: não há asset, banda nem propriedade a apontar. As faixas de cor e
 * os limites vêm do formulário e são os mesmos que a legenda mostra.
 */
function buildChoroplethVisualization(
  ranges: ClassMapping[],
  thresholds: number[],
): CompactMapVisualizationConfig {
  return {
    sourceType: "municipalChoropleth",
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
    outline: { color: "#666666", width: 0.5, opacity: 0.45 },
  };
}

function requireIndicator(
  config: IndexCatalogConfigV2,
): MunicipalValueIndicator {
  if (!config.valueIndicator) {
    throw new Error(
      "Descreva o indicador do índice criado a partir da planilha.",
    );
  }
  return config.valueIndicator;
}

/**
 * O instantâneo que a versão publicada do índice está lendo, repassado sem
 * mudança para a validação não mexer no ponteiro da produção. Quem grava um
 * arquivo novo é `publishSpreadsheetSnapshot`, já com a publicação decidida.
 */
function carryPublishedSnapshot(
  config: IndexCatalogConfigV2,
): MunicipalSpreadsheetSnapshotRef | undefined {
  return isMunicipalSpreadsheetSource(config.validatedStatisticsSource)
    ? config.validatedStatisticsSource.snapshot
    : undefined;
}

/**
 * A prévia de um índice criado a partir de uma planilha do Google.
 *
 * Diferente das outras formas do catálogo, aqui não há nada a validar no Earth
 * Engine: a planilha é a fonte dos valores e os tiles de município já existem
 * na plataforma. O que se valida é a planilha — colunas da convenção, código
 * IBGE por linha e pelo menos uma coluna `{prefixo}_{ano}`.
 *
 * A validação não escreve no Contentful. O instantâneo fica na memória do
 * processo, de onde a prévia o lê, e só a publicação o grava como asset.
 */
export async function buildSpreadsheetIndexDraft(
  config: IndexCatalogConfigV2,
  source: MunicipalSpreadsheetStatisticsSource,
  dependencies: SpreadsheetIndexDraftDependencies = {},
): Promise<IndexCatalogBuildResult> {
  const indicator = requireIndicator(config);
  const ranges = buildRangeClasses(config.classes);
  const thresholds = requireValueThresholds(
    config.earthEngine.thresholds,
    ranges.length,
  );
  const reading = await readSpreadsheetSnapshot(source, dependencies);
  rememberDraftSpreadsheetSnapshot(source, reading.snapshot);

  const publishedSnapshot = carryPublishedSnapshot(config);
  const sourceRevision = hashCatalogValue({
    fileId: source.fileId,
    valuePrefix: source.valuePrefix,
    aggregation: source.aggregation,
    periods: reading.periods,
    snapshotRevision: reading.snapshotRevision,
  });
  const statisticsSource: PublishedMunicipalSpreadsheetSource = {
    ...source,
    ...(publishedSnapshot ? { snapshot: publishedSnapshot } : {}),
    schemaVersion: 1,
    sourceRevision,
  };
  const mapVisualization = buildChoroplethVisualization(ranges, thresholds);
  const panelLayerImageData = {
    schemaVersion: 1,
    type: "territorial-compact" as const,
    defaultYear: reading.periods.at(-1),
    // Uma classe só: o painel mostra o valor do indicador, e as faixas
    // coloridas pertencem à legenda do mapa.
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
    // Sem `imageId`: não existe asset do Earth Engine por trás de uma coropleta.
    years: Object.fromEntries(
      reading.periods.map((period) => [period, { valuesScale: 1, values: {} }]),
    ),
  };

  const validation: CatalogValidationReport = {
    validatedAt: new Date().toISOString(),
    valid: true,
    errors: [],
    warnings: reading.warnings,
    inferred: {
      panelLayerId: config.panelLayerId,
      periods: reading.periods,
      defaultPeriod: reading.periods.at(-1),
      timeScale: inferTimeScale(reading.periods),
      classIndexes: ranges.map((range) => range.classIndex),
      statisticsAssetCount: 1,
      imageDataBytes: Buffer.byteLength(JSON.stringify(panelLayerImageData)),
    },
    sourceFingerprint: hashCatalogValue({
      sourceRevision,
      classes: ranges,
      indicator,
      thresholds,
      periods: reading.periods,
    }),
  };

  return {
    panelLayerImageData,
    validation,
    mapVisualization,
    statisticsSource,
    classes: ranges,
    spreadsheetSnapshot: reading.snapshot,
  };
}
