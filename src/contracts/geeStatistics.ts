export type GeeStatisticsPeriodGranularity = "year" | "month";

export type GeeStatisticsScalarMetric =
  "mean" | "median" | "mode" | "min" | "max";

export type GeeStatisticsAssetSource =
  | {
      type: "fixed";
      assetId: string;
    }
  | {
      type: "period-template";
      assetIdTemplate: string;
    };

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

export interface ResolvedGeeStatisticsSource extends GeeFeatureCollectionStatisticsSource {
  assetId: string;
}

export interface GeeStatisticsSchema {
  classIndexes: number[];
  percentageProperties: string[];
  classAreaProperties: string[];
}

const MONTH_PERIOD_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/u;
const YEAR_PERIOD_PATTERN = /^\d{4}$/u;
const PERCENTAGE_PROPERTY_PATTERN = /^perc_classe_(\d+)$/u;
const CLASS_AREA_PROPERTY_PATTERN = /^area_ha_classe_(\d+)$/u;

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

  const firstIndex = classIndexes[0];
  if (firstIndex !== 0 && firstIndex !== 1) {
    throw new Error(
      `Asset estatístico ${assetId} deve iniciar as classes em 0 ou 1; recebeu ${firstIndex}.`,
    );
  }

  for (let position = 1; position < classIndexes.length; position += 1) {
    if (classIndexes[position] !== classIndexes[position - 1] + 1) {
      throw new Error(
        `Asset estatístico ${assetId} possui lacuna na sequência de classes: ${classIndexes.join(
          ", ",
        )}.`,
      );
    }
  }
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
  const isValidPeriod =
    source.periodGranularity === "month"
      ? MONTH_PERIOD_PATTERN.test(periodKey)
      : YEAR_PERIOD_PATTERN.test(periodKey);

  if (!isValidPeriod) {
    throw new Error(
      `Período ${periodKey} incompatível com granularidade ${source.periodGranularity} do asset estatístico.`,
    );
  }

  const month =
    source.periodGranularity === "month" ? periodKey.slice(5, 7) : null;
  if (
    source.asset.type === "period-template" &&
    source.asset.assetIdTemplate.includes("{month}") &&
    !month
  ) {
    throw new Error(
      "Template de asset com {month} exige uma fonte de granularidade mensal.",
    );
  }

  const assetId =
    source.asset.type === "fixed"
      ? source.asset.assetId
      : source.asset.assetIdTemplate
          .replaceAll("{period}", periodKey)
          .replaceAll("{year}", periodKey.slice(0, 4))
          .replaceAll("{month}", month ?? "");

  if (!assetId.trim() || /\{[^}]+\}/u.test(assetId)) {
    throw new Error(`Configuração de asset estatístico inválida: ${assetId}.`);
  }

  return { ...source, assetId };
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
