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

/**
 * Public, immutable description stored on panelLayer.  The revision is not an
 * arbitrary version number: the catalog recalculates it from the assets,
 * their metadata, schemas and discovered periods every time it validates.
 */
export interface PublishedGeeStatisticsSource extends GeeFeatureCollectionStatisticsSource {
  schemaVersion: 1;
  sourceRevision: string;
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
const ASSET_ID_PATTERN = /^[A-Za-z0-9_./{}-]{3,300}$/u;
const SOURCE_REVISION_PATTERN = /^[a-f0-9]{64}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredProperty(
  value: unknown,
  label: string,
  options: { asset?: boolean; allowTemplate?: boolean } = {},
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} é obrigatório.`);
  }

  const normalized = value.trim();
  if (
    normalized.length > 300 ||
    (options.asset && !ASSET_ID_PATTERN.test(normalized))
  ) {
    throw new Error(`${label} é inválido.`);
  }
  if (!options.allowTemplate && /[{}]/u.test(normalized)) {
    throw new Error(`${label} não pode conter placeholders.`);
  }

  return normalized;
}

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
  if (!isRecord(value.asset) || !isRecord(value.properties)) {
    throw new Error("A configuração da fonte estatística está incompleta.");
  }

  const asset =
    value.asset.type === "fixed"
      ? {
          type: "fixed" as const,
          assetId: requiredProperty(value.asset.assetId, "Asset estatístico", {
            asset: true,
          }),
        }
      : value.asset.type === "period-template"
        ? {
            type: "period-template" as const,
            assetIdTemplate: requiredProperty(
              value.asset.assetIdTemplate,
              "Template do asset estatístico",
              { asset: true, allowTemplate: true },
            ),
          }
        : null;

  if (!asset) {
    throw new Error("A estratégia da fonte estatística é inválida.");
  }
  if (
    asset.type === "period-template" &&
    !/\{(?:year|month|period)\}/u.test(asset.assetIdTemplate)
  ) {
    throw new Error(
      "O template estatístico deve conter {year}, {month} ou {period}.",
    );
  }
  if (
    asset.type === "period-template" &&
    asset.assetIdTemplate.includes("{month}") &&
    value.periodGranularity !== "month"
  ) {
    throw new Error("O placeholder {month} exige granularidade mensal.");
  }

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
    ...parseGeeFeatureCollectionStatisticsSource(value),
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
