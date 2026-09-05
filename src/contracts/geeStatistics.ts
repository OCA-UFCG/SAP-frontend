import {
  assertGeeStatisticsPeriod,
  isGeeStatisticsRecord,
  parseGeeStatisticsAssetSource,
  requiredGeeStatisticsProperty,
  resolveGeeStatisticsAssetId,
} from "@/contracts/geeStatisticsAsset";
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

export interface GeeStatisticsPropertyMapping {
  level: string;
  locationName: string;
  municipalityCode: string;
  stateCode: string;
  year: string;
  date: string;
  totalArea: string;
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

function validateClassIndexes(assetId: string, classIndexes: number[]): void {
  if (classIndexes.length === 0) {
    throw new Error(
      `Asset estatístico ${assetId} não possui colunas perc_classe_XX.`,
    );
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
  // perc_classe_XX é idêntico ao de area_ha_classe_XX (conferido a seguir).
}

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

  validateClassIndexes(source.assetId, classIndexes);

  const areaIndexes = [...classAreaProperties.keys()].sort(
    (left, right) => left - right,
  );
  if (
    classIndexes.length !== areaIndexes.length ||
    classIndexes.some(
      (classIndex, position) => classIndex !== areaIndexes[position],
    )
  ) {
    throw new Error(
      `Asset estatístico ${source.assetId} deve possuir o mesmo conjunto de colunas perc_classe_XX e area_ha_classe_XX.`,
    );
  }

  const requiredProperties = [
    source.properties.level,
    source.properties.locationName,
    source.properties.municipalityCode,
    source.properties.stateCode,
    source.properties.year,
    source.properties.date,
    source.properties.totalArea,
    ...getScalarMetricPropertyNames(source),
  ];
  const missingProperties = requiredProperties.filter(
    (propertyName) => !uniquePropertyNames.includes(propertyName),
  );

  if (missingProperties.length > 0) {
    throw new Error(
      `Asset estatístico ${source.assetId} não possui as colunas obrigatórias: ${missingProperties.join(
        ", ",
      )}.`,
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
