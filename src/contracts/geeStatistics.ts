import {
  assertGeeStatisticsPeriod,
  isGeeStatisticsRecord,
  parseGeeStatisticsAssetSource,
  requiredGeeStatisticsProperty,
  resolveGeeStatisticsAssetId,
} from "@/contracts/geeStatisticsAsset";
import { buildColumnDiagnosis } from "@/contracts/geeStatisticsColumns";
import {
  isGeeMunicipalValueTableSource,
  parseGeeMunicipalValueTableSource,
  type GeeMunicipalValueTableStatisticsSource,
} from "@/contracts/geeMunicipalValueTable";

import type {
  GeeStatisticsAssetSource,
  GeeStatisticsPeriodGranularity,
} from "@/contracts/geeStatisticsAsset";

export type {
  GeeStatisticsAssetSource,
  GeeStatisticsPeriodGranularity,
} from "@/contracts/geeStatisticsAsset";

export type GeeStatisticsScalarMetric =
  "mean" | "median" | "mode" | "min" | "max";

/**
 * Nome canônico da coluna em que os assets de previsão sazonal do CPTEC/INMET
 * gravam o trimestre como sigla de três letras — a inicial de cada mês
 * ("SON" = setembro, outubro, novembro). A publicação do catálogo detecta essa
 * coluna sozinha e grava `properties.season`; é só por ela que a plataforma
 * sabe que um período mensal representa, na verdade, um trimestre.
 */
export const GEE_SEASON_PROPERTY = "temporada";

export interface GeeStatisticsPropertyMapping {
  level: string;
  locationName: string;
  municipalityCode: string;
  stateCode: string;
  year: string;
  date: string;
  totalArea: string;
  /**
   * Coluna do trimestre, presente só nos índices de previsão sazonal. Quando
   * ela existe, o período mensal `2026-09` é exibido como
   * "Setembro - Outubro - Novembro - 2026".
   */
  season?: string;
  scalarMetrics?: Partial<Record<GeeStatisticsScalarMetric, string>>;
}

export interface GeeFeatureCollectionStatisticsSource {
  kind: "gee-feature-collection";
  asset: GeeStatisticsAssetSource;
  periodGranularity: GeeStatisticsPeriodGranularity;
  properties: GeeStatisticsPropertyMapping;
}

/**
 * As duas formas de tabela que uma camada pode publicar: a distribuição por
 * classes (`perc_classe_XX` por nível territorial) e o valor único por
 * município. A segunda existe porque os dados socioeconômicos chegam numa
 * FeatureCollection que é, ao mesmo tempo, a estatística e o asset do mapa.
 */
export type GeeStatisticsSource =
  GeeFeatureCollectionStatisticsSource | GeeMunicipalValueTableStatisticsSource;

interface PublishedStatisticsSourceStamp {
  schemaVersion: 1;
  sourceRevision: string;
}

/**
 * Public, immutable description stored on panelLayer.  The revision is not an
 * arbitrary version number: the catalog recalculates it from the assets,
 * their metadata, schemas and discovered periods every time it validates.
 */
export type PublishedGeeStatisticsSource = GeeStatisticsSource &
  PublishedStatisticsSourceStamp;

export type PublishedGeeMunicipalValueTableSource =
  GeeMunicipalValueTableStatisticsSource & PublishedStatisticsSourceStamp;

export interface ResolvedGeeStatisticsSource extends GeeFeatureCollectionStatisticsSource {
  assetId: string;
}

export interface GeeStatisticsSchema {
  classIndexes: number[];
  percentageProperties: string[];
  classAreaProperties: string[];
  /**
   * Coluna do trimestre encontrada no asset, quando ela existe. Sai da mesma
   * leitura de colunas que já descobre as classes, então detectar um índice
   * sazonal não custa nenhuma ida extra ao Earth Engine.
   */
  seasonProperty?: string;
}

const PERCENTAGE_PROPERTY_PATTERN = /^perc_classe_(\d+)$/u;
const CLASS_AREA_PROPERTY_PATTERN = /^area_ha_classe_(\d+)$/u;
const SOURCE_REVISION_PATTERN = /^[a-f0-9]{64}$/u;

const isRecord = isGeeStatisticsRecord;
const requiredProperty = requiredGeeStatisticsProperty;

export function parseGeeFeatureCollectionStatisticsSource(
  value: unknown,
): GeeFeatureCollectionStatisticsSource {
  if (!isRecord(value) || value.kind !== "gee-feature-collection") {
    throw new Error("A fonte estatística deve ser uma FeatureCollection GEE.");
  }
  if (
    value.periodGranularity !== "year" &&
    value.periodGranularity !== "month"
  ) {
    throw new Error("A granularidade estatística deve ser anual ou mensal.");
  }
  if (!isRecord(value.properties)) {
    throw new Error("A configuração da fonte estatística está incompleta.");
  }

  const asset = parseGeeStatisticsAssetSource(
    value.asset,
    value.periodGranularity,
  );

  const properties = value.properties;
  const scalarMetricProperties = isRecord(properties.scalarMetrics)
    ? properties.scalarMetrics
    : null;
  const scalarMetrics = scalarMetricProperties
    ? Object.fromEntries(
        (["mean", "median", "mode", "min", "max"] as const).flatMap(
          (metric) => {
            const property = scalarMetricProperties[metric];
            return typeof property === "string" && property.trim()
              ? [[metric, property.trim()]]
              : [];
          },
        ),
      )
    : undefined;

  return {
    kind: "gee-feature-collection",
    asset,
    periodGranularity: value.periodGranularity,
    properties: {
      level: requiredProperty(properties.level, "Propriedade de nível"),
      locationName: requiredProperty(
        properties.locationName,
        "Propriedade de localidade",
      ),
      municipalityCode: requiredProperty(
        properties.municipalityCode,
        "Propriedade de município",
      ),
      stateCode: requiredProperty(properties.stateCode, "Propriedade de UF"),
      year: requiredProperty(properties.year, "Propriedade de ano"),
      date: requiredProperty(properties.date, "Propriedade de data"),
      totalArea: requiredProperty(
        properties.totalArea,
        "Propriedade de área total",
      ),
      ...(typeof properties.season === "string" && properties.season.trim()
        ? { season: properties.season.trim() }
        : {}),
      ...(scalarMetrics && Object.keys(scalarMetrics).length > 0
        ? { scalarMetrics }
        : {}),
    },
  };
}

/**
 * Uma fonte de qualquer das duas formas, escolhida pelo `kind`.
 *
 * O `kind` ausente ou desconhecido cai na distribuição por classes, que é a
 * única forma que existia antes e a que produz a mensagem de erro útil para uma
 * configuração incompleta.
 */
export function parseGeeStatisticsSource(value: unknown): GeeStatisticsSource {
  return isGeeMunicipalValueTableSource(value)
    ? parseGeeMunicipalValueTableSource(value)
    : parseGeeFeatureCollectionStatisticsSource(value);
}

export function parsePublishedGeeStatisticsSource(
  value: unknown,
): PublishedGeeStatisticsSource {
  if (!isRecord(value) || value.schemaVersion !== 1) {
    throw new Error("Versão do contrato statisticsSource inválida.");
  }
  if (
    typeof value.sourceRevision !== "string" ||
    !SOURCE_REVISION_PATTERN.test(value.sourceRevision)
  ) {
    throw new Error("Revisão da fonte estatística inválida.");
  }

  return {
    ...parseGeeStatisticsSource(value),
    schemaVersion: 1,
    sourceRevision: value.sourceRevision,
  };
}

export function tryParsePublishedGeeStatisticsSource(
  value: unknown,
): PublishedGeeStatisticsSource | null {
  if (value == null) return null;
  try {
    return parsePublishedGeeStatisticsSource(value);
  } catch {
    return null;
  }
}

function getScalarMetricPropertyNames(
  source: ResolvedGeeStatisticsSource,
): string[] {
  return Object.values(source.properties.scalarMetrics ?? {}).filter(
    (propertyName): propertyName is string => typeof propertyName === "string",
  );
}

function getIndexedProperties(
  propertyNames: string[],
  pattern: RegExp,
): Map<number, string> {
  const properties = new Map<number, string>();

  for (const propertyName of propertyNames) {
    const match = propertyName.match(pattern);
    if (!match) {
      continue;
    }

    const classIndex = Number(match[1]);
    if (properties.has(classIndex)) {
      throw new Error(
        `Schema estatístico possui índice de classe duplicado: ${classIndex}.`,
      );
    }

    properties.set(classIndex, propertyName);
  }

  return properties;
}

/** O papel de cada coluna mapeada, para o erro dizer o que ela deveria trazer. */
const SCALAR_METRIC_ROLES: Record<GeeStatisticsScalarMetric, string> = {
  mean: "média",
  median: "mediana",
  mode: "moda",
  min: "mínimo",
  max: "máximo",
};

function getMappedColumns(
  source: ResolvedGeeStatisticsSource,
): Array<[string, string]> {
  const { properties } = source;
  return [
    [properties.level, "nível territorial"],
    [properties.locationName, "nome do território"],
    [properties.municipalityCode, "código do município"],
    [properties.stateCode, "UF"],
    [properties.year, "ano"],
    [properties.date, "data"],
    [properties.totalArea, "área total"],
    ...Object.entries(properties.scalarMetrics ?? {}).flatMap(
      ([metric, column]): Array<[string, string]> =>
        typeof column === "string"
          ? [[column, SCALAR_METRIC_ROLES[metric as GeeStatisticsScalarMetric]]]
          : [],
    ),
  ];
}

function findMissingMappedColumns(
  source: ResolvedGeeStatisticsSource,
  columnNames: string[],
): string[] {
  const missing = getMappedColumns(source)
    .filter(([column]) => !columnNames.includes(column))
    .map(([column, role]) => `${column} (${role})`);
  return missing.length > 0
    ? [`não tem estas colunas do mapeamento: ${missing.join(", ")}`]
    : [];
}

/**
 * O que impede as colunas de classe de virarem um schema, ou uma lista vazia.
 *
 * Devolve os problemas em vez de lançar porque a mensagem do catálogo junta
 * todos: parar no primeiro esconderia que o mapeamento territorial também não
 * bate, e a pessoa descobriria um erro por vez.
 */
function findClassColumnProblems(
  classIndexes: number[],
  areaIndexes: number[],
): string[] {
  if (classIndexes.length === 0) {
    return ["não possui colunas perc_classe_XX"];
  }

  // Nem o índice inicial nem a continuidade da sequência são exigidos, e isso é
  // deliberado. Assets reais chegam com classes começando em 0, em 1 e em
  // valores arbitrários (perc_classe_2 em Estatisticas_IA_atlas_BR_DWGD_1990), e
  // também com lacunas: a cobertura do solo do IBGE
  // (Estatistica_Multinivel_cobertura_solo_IBGE) usa as classes
  // 1 a 6 e 9 a 14, porque 7 e 8 não existem na legenda dela — e os pixels 7 e 8
  // também não existem no raster correspondente.
  //
  // Tudo que consome o schema é posicional: `percentageProperties` e
  // `classAreaProperties` são montados na ordem crescente de `classIndexes`, o
  // repositório lê as colunas pelo nome nessa mesma ordem, e `buildClasses`
  // casa classe com cor por posição. O único lugar que dependia de contiguidade
  // era a paleta do mapa, onde `min`/`max`/`palette` iam direto para o Earth
  // Engine, que distribui a paleta linearmente no intervalo: com lacunas, as
  // cores saíam trocadas de classe. Isso passou a ser resolvido em
  // `resolveMapVisualizationPlan`, que remapeia valores esparsos para posições
  // densas antes de visualizar.
  //
  // O que continua garantido aqui: existe ao menos uma classe, os índices são
  // únicos (`getIndexedProperties` rejeita duplicata) e o conjunto de colunas
  // perc_classe_XX é idêntico ao de area_ha_classe_XX (conferido logo abaixo).
  const unpaired = [
    ...classIndexes
      .filter((classIndex) => !areaIndexes.includes(classIndex))
      .map((classIndex) => `area_ha_classe_${classIndex}`),
    ...areaIndexes
      .filter((classIndex) => !classIndexes.includes(classIndex))
      .map((classIndex) => `perc_classe_${classIndex}`),
  ];
  return unpaired.length > 0
    ? [`não tem o par de todas as classes: ${unpaired.join(", ")}`]
    : [];
}

/**
 * O schema de classes que as colunas do asset descrevem.
 *
 * Quando elas não descrevem nenhum, o erro traz **todos** os problemas de uma
 * vez, as colunas que o asset tem de verdade e a forma de tabela que elas
 * sugerem. Quem cadastra um índice não abre o Code Editor do Earth Engine: uma
 * mensagem por problema significava uma validação por problema.
 *
 * @example
 * inferGeeStatisticsSchema(source, ["CD_MUN", "2024"]);
 * // Error: Asset estatístico projects/x/assets/municipios: não possui colunas
 * // perc_classe_XX; não tem estas colunas do mapeamento: ano (ano)…
 */
export function inferGeeStatisticsSchema(
  source: ResolvedGeeStatisticsSource,
  propertyNames: string[],
): GeeStatisticsSchema {
  const uniquePropertyNames = [...new Set(propertyNames)];
  const percentageProperties = getIndexedProperties(
    uniquePropertyNames,
    PERCENTAGE_PROPERTY_PATTERN,
  );
  const classAreaProperties = getIndexedProperties(
    uniquePropertyNames,
    CLASS_AREA_PROPERTY_PATTERN,
  );
  const classIndexes = [...percentageProperties.keys()].sort(
    (left, right) => left - right,
  );
  const areaIndexes = [...classAreaProperties.keys()].sort(
    (left, right) => left - right,
  );

  const problems = [
    ...findClassColumnProblems(classIndexes, areaIndexes),
    ...findMissingMappedColumns(source, uniquePropertyNames),
  ];
  if (problems.length > 0) {
    throw new Error(
      buildColumnDiagnosis({
        assetId: source.assetId,
        problems,
        columnNames: uniquePropertyNames,
        shape: "classes",
      }),
    );
  }

  return {
    classIndexes,
    percentageProperties: classIndexes.map((classIndex) =>
      percentageProperties.get(classIndex)!,
    ),
    classAreaProperties: classIndexes.map((classIndex) =>
      classAreaProperties.get(classIndex)!,
    ),
    ...(uniquePropertyNames.includes(GEE_SEASON_PROPERTY)
      ? { seasonProperty: GEE_SEASON_PROPERTY }
      : {}),
  };
}

export function resolveGeeStatisticsSource(
  source: GeeFeatureCollectionStatisticsSource,
  periodKey: string,
): ResolvedGeeStatisticsSource {
  assertGeeStatisticsPeriod(periodKey, source.periodGranularity);

  return {
    ...source,
    assetId: resolveGeeStatisticsAssetId(
      source.asset,
      periodKey,
      source.periodGranularity,
    ),
  };
}

export function getGeeStatisticsRequestedProperties(
  source: ResolvedGeeStatisticsSource,
  schema: GeeStatisticsSchema,
): string[] {
  return [
    source.properties.level,
    source.properties.locationName,
    source.properties.municipalityCode,
    source.properties.stateCode,
    source.properties.year,
    source.properties.date,
    source.properties.totalArea,
    ...schema.percentageProperties,
    ...schema.classAreaProperties,
    ...getScalarMetricPropertyNames(source),
  ].filter(
    (propertyName, index, properties) =>
      properties.indexOf(propertyName) === index,
  );
}
