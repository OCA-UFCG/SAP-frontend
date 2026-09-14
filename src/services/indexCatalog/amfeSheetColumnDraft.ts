import "server-only";

import type { AmfeSheetColumnStatisticsSource } from "@/contracts/amfeSheetColumn";
import type { PublishedAmfeSheetColumnSource } from "@/contracts/geeStatistics";
import {
  collectColumnValues,
  countStatesWithValue,
  type AmfeSheetTable,
} from "@/repositories/platform/amfeSheetTable";
import { getAmfeSheetTable } from "@/repositories/platform/amfeSheetRepository";
import { hashCatalogValue } from "@/services/indexCatalog/catalogFingerprint";
import {
  buildRangeClasses,
  buildValueTemplates,
  requireIndicator,
  requireThresholds,
} from "@/services/indexCatalog/municipalValueTableDraft";
import type {
  CatalogValidationReport,
  IndexCatalogBuildResult,
  IndexCatalogConfigV2,
} from "@/types/indexCatalog";
import type {
  ClassMapping,
  MunicipalValueIndicator,
} from "@/types/indexCatalog";
import type { CompactMapVisualizationConfig } from "@/utils/analysis";

/**
 * Uma coluna com valor em pouquíssimas UFs quase sempre é engano de coluna, e o
 * ranking nacional do painel sairia com duas linhas. Não é um erro: a planilha
 * pode ter mesmo um critério regional, e o catálogo avisa em vez de recusar.
 */
const MIN_STATES_WITHOUT_WARNING = 5;

/**
 * O mapa de um índice de planilha é pintado município a município no navegador.
 * A paleta e os limites viajam no `imageData` como nas demais camadas — o que
 * muda é quem desenha, e é `municipalChoropleth` que diz isso ao Monitoramento.
 */
function buildSheetMapVisualization(
  column: string,
  ranges: ClassMapping[],
  thresholds: number[],
): CompactMapVisualizationConfig {
  return {
    municipalChoropleth: { source: "amfe-sheet", column },
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
  };
}

function findCriterion(table: AmfeSheetTable, column: string) {
  const criterion = table.criteria.find(
    (candidate) => candidate.column === column,
  );

  if (!criterion) {
    throw new Error(
      `A coluna "${column}" não existe na planilha da análise multicritério. Colunas disponíveis: ${table.criteria
        .map((candidate) => candidate.column)
        .join(", ")}.`,
    );
  }

  return criterion;
}

function buildWarnings(
  table: AmfeSheetTable,
  source: AmfeSheetColumnStatisticsSource,
  valueCount: number,
) {
  const warnings = [
    {
      code: "aggregate_scopes_unavailable",
      message: `A planilha traz ${table.municipalities.length} municípios e o painel deriva Brasil e UFs por ${
        source.aggregation === "sum" ? "soma" : "média"
      }. Recortes de região, bioma, ASD e semiárido ficam sem valor: eles não saem de uma tabela municipal.`,
    },
    {
      code: "single_period",
      message: `A planilha não tem eixo de tempo: o índice fica publicado só em ${source.periodKey}, sem gráfico de série histórica no painel.`,
    },
  ];

  const missing = table.municipalities.length - valueCount;
  if (missing > 0) {
    warnings.push({
      code: "municipalities_without_value",
      message: `${missing} município(s) estão sem valor nesta coluna e vão aparecer em cinza no mapa, como "sem dado".`,
    });
  }

  const stateCount = countStatesWithValue(table, source.column);
  if (stateCount < MIN_STATES_WITHOUT_WARNING) {
    warnings.push({
      code: "few_states_with_value",
      message: `Só ${stateCount} UF(s) têm valor nesta coluna; confira se é a coluna certa antes de publicar.`,
    });
  }

  return warnings;
}

function buildRankingTitle(indicator: MunicipalValueIndicator) {
  return `Estados por ${indicator.label.toLocaleLowerCase("pt-BR")}`;
}

/**
 * A prévia de um índice cujos valores vêm de uma coluna da planilha da análise
 * multicritério.
 *
 * Não há asset nenhum a validar no Earth Engine: a conferência é a da própria
 * planilha — a coluna existe, tem valores numéricos e cobre municípios de mais
 * de uma UF. O período é o ano escolhido no formulário, porque a planilha é uma
 * foto só.
 */
export async function buildAmfeSheetColumnDraft(
  config: IndexCatalogConfigV2,
  source: AmfeSheetColumnStatisticsSource,
): Promise<IndexCatalogBuildResult> {
  const indicator = requireIndicator(config);
  const ranges = buildRangeClasses(config.classes);
  const thresholds = requireThresholds(config, ranges.length);
  const table = await getAmfeSheetTable();
  const criterion = findCriterion(table, source.column);
  const values = collectColumnValues(table, source.column);

  if (values.length === 0) {
    throw new Error(
      `A coluna "${source.column}" (${criterion.label}) não tem nenhum valor numérico na planilha.`,
    );
  }

  const periods = [source.periodKey];
  // A revisão muda quando a planilha muda: sem os valores no cálculo, uma
  // edição na planilha passaria despercebida e a prévia continuaria dizendo que
  // o índice foi validado contra o conteúdo atual.
  const sourceRevision = hashCatalogValue({
    source,
    municipalityCount: table.municipalities.length,
    valueCount: values.length,
    values,
  });
  const statisticsSource: PublishedAmfeSheetColumnSource = {
    ...source,
    schemaVersion: 1,
    sourceRevision,
  };
  const mapVisualization = buildSheetMapVisualization(
    source.column,
    ranges,
    thresholds,
  );
  const panelLayerImageData = {
    schemaVersion: 1,
    type: "territorial-compact" as const,
    defaultYear: source.periodKey,
    classes: [
      {
        id: config.panelLayerId,
        label: indicator.label,
        color: indicator.color,
      },
    ],
    locations: { br: "Brasil" },
    templates: buildValueTemplates(indicator),
    ranking: { title: buildRankingTitle(indicator), totalLabel: "Estados" },
    valueConfig: {
      type: indicator.valueType,
      unit: indicator.measurementUnit,
      distributionTitle: indicator.label,
    },
    mapVisualization,
    years: {
      [source.periodKey]: {
        // O contrato exige um `imageId` não vazio em cada período. Aqui ele é
        // uma etiqueta de procedência, e não um endereço: esta camada não pede
        // tile nenhum ao Earth Engine.
        imageId: `planilha-amfe:${source.column}`,
        valuesScale: 1,
        values: {},
      },
    },
  };

  const validation: CatalogValidationReport = {
    validatedAt: new Date().toISOString(),
    valid: true,
    errors: [],
    warnings: buildWarnings(table, source, values.length),
    inferred: {
      panelLayerId: config.panelLayerId,
      periods,
      defaultPeriod: source.periodKey,
      timeScale: "Anual",
      classIndexes: ranges.map((range) => range.classIndex),
      statisticsAssetCount: 0,
      imageDataBytes: Buffer.byteLength(JSON.stringify(panelLayerImageData)),
    },
    sourceFingerprint: hashCatalogValue({
      sourceRevision,
      classes: ranges,
      indicator,
      thresholds,
      periods,
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
