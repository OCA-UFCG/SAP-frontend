import {
  assertGeeStatisticsPeriod,
  expandGeeStatisticsPeriodTemplate,
  isGeeStatisticsRecord,
  parseGeeStatisticsAssetSource,
  PERIOD_PLACEHOLDER_PATTERN,
  requiredGeeStatisticsProperty,
  resolveGeeStatisticsAssetId,
  type GeeStatisticsAssetSource,
  type GeeStatisticsPeriodGranularity,
} from "@/contracts/geeStatisticsAsset";

/**
 * Como estado e Brasil saem das linhas municipais. `sum` para contagens (o
 * total de registros de secas do S2ID) e `mean` para percentuais (o percentual
 * de pobreza do CadÚnico). Não há terceira opção porque não há coluna de peso:
 * a tabela traz o valor do município e nada mais.
 */
export type GeeMunicipalValueAggregation = "sum" | "mean";

export interface GeeMunicipalValueTablePropertyMapping {
  /** Código IBGE de 7 dígitos, a chave territorial da plataforma. */
  municipalityCode: string;
  /** Nome do município exibido no painel. */
  locationName: string;
  /** Sigla (`PB`) ou nome (`Paraíba`) da UF; as duas grafias são aceitas. */
  stateCode: string;
}

/**
 * Estatística lida de uma FeatureCollection municipal larga: uma linha por
 * município e um valor único por período, em vez da distribuição por classes de
 * `gee-feature-collection`.
 *
 * É a forma em que chegam os dados socioeconômicos, em que a mesma
 * FeatureCollection é ao mesmo tempo a tabela de estatísticas e o asset que
 * desenha o mapa (`reduceToImage` sobre a coluna do período).
 *
 * @example
 * const source: GeeMunicipalValueTableStatisticsSource = {
 *   kind: "gee-municipal-value-table",
 *   asset: { type: "fixed", assetId: "projects/x/assets/pob_total" },
 *   periodGranularity: "year",
 *   valueProperty: "{year}",
 *   aggregation: "mean",
 *   properties: {
 *     municipalityCode: "CD_MUN",
 *     locationName: "NM_MUN",
 *     stateCode: "SIGLA_UF",
 *   },
 * };
 */
export interface GeeMunicipalValueTableStatisticsSource {
  kind: "gee-municipal-value-table";
  asset: GeeStatisticsAssetSource;
  periodGranularity: GeeStatisticsPeriodGranularity;
  /** Coluna com o valor do período; aceita `{year}`, `{month}` e `{period}`. */
  valueProperty: string;
  aggregation: GeeMunicipalValueAggregation;
  properties: GeeMunicipalValueTablePropertyMapping;
}

export interface ResolvedGeeMunicipalValueTableSource extends GeeMunicipalValueTableStatisticsSource {
  assetId: string;
  /** Nome da coluna já resolvido para o período pedido. */
  valueColumn: string;
}

export function isGeeMunicipalValueTableSource(
  value: unknown,
): value is GeeMunicipalValueTableStatisticsSource {
  return (
    isGeeStatisticsRecord(value) && value.kind === "gee-municipal-value-table"
  );
}

export function parseGeeMunicipalValueTableSource(
  value: unknown,
): GeeMunicipalValueTableStatisticsSource {
  if (!isGeeMunicipalValueTableSource(value)) {
    throw new Error(
      "A fonte estatística deve ser uma tabela municipal de valor único.",
    );
  }
  if (
    value.periodGranularity !== "year" &&
    value.periodGranularity !== "month"
  ) {
    throw new Error("A granularidade estatística deve ser anual ou mensal.");
  }
  if (value.aggregation !== "sum" && value.aggregation !== "mean") {
    throw new Error(
      "A agregação territorial deve ser soma ou média dos municípios.",
    );
  }
  if (!isGeeStatisticsRecord(value.properties)) {
    throw new Error("A configuração da fonte estatística está incompleta.");
  }

  const asset = parseGeeStatisticsAssetSource(
    value.asset,
    value.periodGranularity,
  );
  const valueProperty = requiredGeeStatisticsProperty(
    value.valueProperty,
    "Coluna do valor",
    { allowTemplate: true },
  );
  if (
    valueProperty.includes("{month}") &&
    value.periodGranularity !== "month"
  ) {
    throw new Error("O placeholder {month} exige granularidade mensal.");
  }
  // Sem eixo de período não existe série: uma tabela fixa lida sempre pela mesma
  // coluna devolveria o mesmo número em todos os anos, e ninguém veria o erro
  // porque o painel mostraria um gráfico plano em vez de falhar.
  if (
    asset.type === "fixed" &&
    !PERIOD_PLACEHOLDER_PATTERN.test(valueProperty)
  ) {
    throw new Error(
      "Numa FeatureCollection única a coluna do valor deve conter {year}, {month} ou {period} — é ela que separa os períodos.",
    );
  }

  const properties = value.properties;
  return {
    kind: "gee-municipal-value-table",
    asset,
    periodGranularity: value.periodGranularity,
    valueProperty,
    aggregation: value.aggregation,
    properties: {
      municipalityCode: requiredGeeStatisticsProperty(
        properties.municipalityCode,
        "Propriedade de município",
      ),
      locationName: requiredGeeStatisticsProperty(
        properties.locationName,
        "Propriedade de localidade",
      ),
      stateCode: requiredGeeStatisticsProperty(
        properties.stateCode,
        "Propriedade de UF",
      ),
    },
  };
}

/**
 * O asset e a coluna concretos de um período.
 *
 * resolveGeeMunicipalValueTableSource(source, "2024").valueColumn; // "2024"
 */
export function resolveGeeMunicipalValueTableSource(
  source: GeeMunicipalValueTableStatisticsSource,
  periodKey: string,
): ResolvedGeeMunicipalValueTableSource {
  assertGeeStatisticsPeriod(periodKey, source.periodGranularity);

  return {
    ...source,
    assetId: resolveGeeStatisticsAssetId(
      source.asset,
      periodKey,
      source.periodGranularity,
    ),
    valueColumn: expandGeeStatisticsPeriodTemplate(
      source.valueProperty,
      periodKey,
      source.periodGranularity,
      {
        templateLabel: "Coluna do valor",
        invalidMessage: "Coluna do valor inválida",
      },
    ),
  };
}

/**
 * As colunas que a leitura precisa pedir ao Earth Engine para um território.
 *
 * Município e UF entram sempre: o primeiro é a chave da plataforma e o segundo
 * é o que agrupa os estados do ranking nacional.
 */
export function getGeeMunicipalValueTableProperties(
  source: GeeMunicipalValueTableStatisticsSource,
): string[] {
  return [
    source.properties.municipalityCode,
    source.properties.locationName,
    source.properties.stateCode,
  ];
}
