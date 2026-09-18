import "server-only";

import type {
  MunicipalSpreadsheetStatisticsSource,
  MunicipalSpreadsheetSnapshotRef,
} from "@/contracts/municipalSpreadsheet";
import type { PublishedMunicipalSpreadsheetSource } from "@/contracts/geeStatistics";
import { readGoogleSpreadsheet } from "@/infrastructure/google-drive/spreadsheetReader";
import { hashCatalogValue } from "@/services/indexCatalog/catalogFingerprint";
import { saveSpreadsheetSnapshot } from "@/services/indexCatalog/spreadsheetSnapshotStorage";
import type {
  CatalogValidationIssue,
  CatalogValidationReport,
  ClassMapping,
  IndexCatalogBuildResult,
  IndexCatalogConfigV2,
  MunicipalValueIndicator,
} from "@/types/indexCatalog";
import type { CompactMapVisualizationConfig } from "@/utils/analysis";
import { inferTimeScale } from "@/utils/indexCatalog";
import { aggregateMunicipalSpreadsheet } from "@/utils/municipalSpreadsheetAggregation";
import {
  assertSpreadsheetColumns,
  readMunicipalSpreadsheetRows,
  resolveSpreadsheetPeriodColumns,
} from "@/utils/municipalSpreadsheetTable";
import {
  buildRangeClasses,
  buildValueTemplates,
  requireValueThresholds,
} from "@/utils/municipalValueIndicator";

export interface SpreadsheetIndexDraftDependencies {
  readSpreadsheet?: typeof readGoogleSpreadsheet;
  saveSnapshot?: typeof saveSpreadsheetSnapshot;
}

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

function buildWarnings(
  missingByPeriod: Record<string, number>,
  unknownStateCount: number,
  municipalityCount: number,
): CatalogValidationIssue[] {
  const incomplete = Object.entries(missingByPeriod).filter(
    ([, missing]) => missing > 0,
  );
  return [
    ...(incomplete.length > 0
      ? [
          {
            code: "spreadsheet_missing_values",
            message: `A planilha tem municípios sem valor: ${incomplete
              .map(([period, missing]) => `${period} (${missing})`)
              .join(
                ", ",
              )}. Eles aparecem como "sem dado" no mapa e ficam fora das somas dos territórios maiores.`,
          },
        ]
      : []),
    ...(unknownStateCount > 0
      ? [
          {
            code: "spreadsheet_unknown_state",
            message: `${unknownStateCount} de ${municipalityCount} municípios têm UF que não reconheci em SIGLA_UF/NM_UF; eles ficam fora do ranking de estados.`,
          },
        ]
      : []),
  ];
}

interface SpreadsheetReading {
  periods: string[];
  municipalityCount: number;
  snapshot: MunicipalSpreadsheetSnapshotRef;
  snapshotRevision: string;
  warnings: CatalogValidationIssue[];
}

/**
 * Lê a planilha, agrega todos os recortes e guarda o instantâneo.
 *
 * O instantâneo é gravado já na validação, e não só na publicação, porque é
 * dele que a prévia do catálogo lê os valores: assim o que o operador confere
 * na prévia é exatamente o arquivo que a plataforma vai servir.
 */
async function readAndStoreSpreadsheet(
  config: IndexCatalogConfigV2,
  source: MunicipalSpreadsheetStatisticsSource,
  {
    readSpreadsheet = readGoogleSpreadsheet,
    saveSnapshot = saveSpreadsheetSnapshot,
  }: SpreadsheetIndexDraftDependencies,
): Promise<SpreadsheetReading> {
  const table = await readSpreadsheet(source.fileId);
  const periodColumns = resolveSpreadsheetPeriodColumns(
    table.header,
    source.valuePrefix,
  );
  assertSpreadsheetColumns(table.header, periodColumns, source.valuePrefix);

  const periods = periodColumns.map((column) => column.periodKey);
  const { rows } = readMunicipalSpreadsheetRows(
    table.header,
    table.rows,
    periodColumns,
  );
  if (rows.length === 0) {
    throw new Error(
      `A planilha ${source.fileId} não tem nenhuma linha com código de município em CD_MUN.`,
    );
  }

  const aggregated = aggregateMunicipalSpreadsheet(
    rows,
    periods,
    source.aggregation,
  );
  const snapshot = await saveSnapshot(
    config.panelLayerId,
    aggregated.snapshot,
    source.snapshot?.assetId,
  );

  return {
    periods,
    municipalityCount: rows.length,
    snapshot,
    // A revisão não olha a planilha inteira: ela resume os valores agregados,
    // que é o que muda o índice publicado.
    snapshotRevision: hashCatalogValue(aggregated.snapshot.values),
    warnings: buildWarnings(
      aggregated.missingByPeriod,
      aggregated.unknownStateCount,
      rows.length,
    ),
  };
}

/**
 * A prévia de um índice criado a partir de uma planilha do Google.
 *
 * Diferente das outras formas do catálogo, aqui não há nada a validar no Earth
 * Engine: a planilha é a fonte dos valores e os tiles de município já existem
 * na plataforma. O que se valida é a planilha — colunas da convenção, código
 * IBGE por linha e pelo menos uma coluna `{prefixo}_{ano}`.
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
  const reading = await readAndStoreSpreadsheet(config, source, dependencies);

  const sourceRevision = hashCatalogValue({
    fileId: source.fileId,
    valuePrefix: source.valuePrefix,
    aggregation: source.aggregation,
    periods: reading.periods,
    snapshotRevision: reading.snapshotRevision,
  });
  const statisticsSource: PublishedMunicipalSpreadsheetSource = {
    ...source,
    snapshot: reading.snapshot,
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
  };
}
