import "server-only";

import ee from "@google/earthengine";
import { getGeeStatisticsSource } from "@/config/geeStatistics";
import {
  getGeeStatisticsRequestedProperties,
  inferGeeStatisticsSchema,
  resolveGeeStatisticsSource,
} from "@/contracts/geeStatistics";
import type {
  GeeStatisticsSchema,
  ResolvedGeeStatisticsSource,
} from "@/contracts/geeStatistics";
import { buildSpatialLocationKey } from "@/contracts/spatialLocationKey.mjs";
import {
  evaluateGeeObject,
  initializeGee,
} from "@/infrastructure/earth-engine/client";
import type { CompactTerritorialAnalysisDatasetPatch } from "@/utils/municipalAnalysisMerge";
import { statesObj } from "@/utils/constants";

const MUNICIPALITY_KEY_PATTERN = /^\d{7}$/u;
const STATE_KEY_PATTERN = /^[a-z]{2}$/u;
const AGGREGATE_LOCATION_PATTERN = /^(2_regiao|3_bioma|4_asd|5_semiarido)-/u;

const SOURCE_LEVEL_BY_LOCATION_PREFIX: Record<string, string> = {
  "2_regiao": "2_Regiao",
  "3_bioma": "3_Bioma",
  "4_asd": "4_ASD",
  "5_semiarido": "5_Semiarido",
};
const PERCENTAGE_SUM_TOLERANCE = 0.2;

interface EvaluatedFeature {
  properties?: Record<string, unknown>;
}

interface EvaluatedFeatureCollection {
  features?: EvaluatedFeature[];
}

const propertyNamesByAssetId = new Map<string, Promise<string[]>>();

export interface GeeStatisticsMetrics {
  areaTotalHa?: number;
  classAreaHa?: number[];
  mean?: number;
  median?: number;
  mode?: number;
  min?: number;
  max?: number;
}

export interface GeeStatisticsYearResult {
  assetId: string;
  featureCount: number;
  omittedZeroValueLocationKeys: string[];
  patch: CompactTerritorialAnalysisDatasetPatch;
  metrics: Record<string, GeeStatisticsMetrics>;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeComparableText(value: unknown): string {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const stateCodeByName = new Map(
  Object.entries(statesObj).map(([stateCode, stateName]) => [
    normalizeComparableText(stateName),
    stateCode,
  ]),
);

function getStateCode(
  source: ResolvedGeeStatisticsSource,
  row: Record<string, unknown>,
): string | null {
  const rawStateCode = normalizeText(
    row[source.properties.stateCode],
  ).toLowerCase();

  if (STATE_KEY_PATTERN.test(rawStateCode) && rawStateCode in statesObj) {
    return rawStateCode;
  }

  const name = normalizeComparableText(row[source.properties.locationName]);
  return stateCodeByName.get(name) ?? null;
}

function getLocation(
  source: ResolvedGeeStatisticsSource,
  row: Record<string, unknown>,
): { key: string; label: string } {
  const level = normalizeText(row[source.properties.level]);
  const locationName = normalizeText(row[source.properties.locationName]);

  if (level === "1_BR") {
    return { key: "br", label: "Brasil" };
  }

  if (level === "6_Estado") {
    const stateCode = getStateCode(source, row);

    if (!stateCode) {
      throw new Error(
        `Linha estadual do GEE sem UF reconhecida: ${locationName}`,
      );
    }

    return {
      key: stateCode,
      label: statesObj[stateCode as keyof typeof statesObj] ?? locationName,
    };
  }

  if (level === "7_Municipio") {
    const municipalityCode = normalizeText(
      row[source.properties.municipalityCode],
    );

    if (!MUNICIPALITY_KEY_PATTERN.test(municipalityCode)) {
      throw new Error(
        `Linha municipal do GEE sem CD_MUN válido: ${municipalityCode || locationName}`,
      );
    }

    const stateCode = getStateCode(source, row)?.toUpperCase();
    return {
      key: municipalityCode,
      label: stateCode ? `${locationName} - ${stateCode}` : locationName,
    };
  }

  return {
    key: buildSpatialLocationKey(level, locationName),
    label: locationName,
  };
}

function toFiniteNumber(value: unknown, context: string): number {
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor estatístico inválido em ${context}.`);
  }

  return parsed;
}

function toOptionalFiniteNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getMetrics(
  source: ResolvedGeeStatisticsSource,
  schema: GeeStatisticsSchema,
  row: Record<string, unknown>,
): GeeStatisticsMetrics {
  const classAreaHa = schema.classAreaProperties.map((property) =>
    toOptionalFiniteNumber(row[property]),
  );
  const scalarMetrics = source.properties.scalarMetrics;

  if (
    classAreaHa.some((value) => value !== undefined) &&
    classAreaHa.some((value) => value === undefined)
  ) {
    throw new Error(
      `Linha do asset estatístico ${source.assetId} possui áreas de classe incompletas.`,
    );
  }

  return {
    areaTotalHa: toOptionalFiniteNumber(row[source.properties.totalArea]),
    ...(classAreaHa.some((value) => value !== undefined)
      ? { classAreaHa: classAreaHa as number[] }
      : {}),
    ...(scalarMetrics?.mean
      ? { mean: toOptionalFiniteNumber(row[scalarMetrics.mean]) }
      : {}),
    ...(scalarMetrics?.median
      ? { median: toOptionalFiniteNumber(row[scalarMetrics.median]) }
      : {}),
    ...(scalarMetrics?.mode
      ? { mode: toOptionalFiniteNumber(row[scalarMetrics.mode]) }
      : {}),
    ...(scalarMetrics?.min
      ? { min: toOptionalFiniteNumber(row[scalarMetrics.min]) }
      : {}),
    ...(scalarMetrics?.max
      ? { max: toOptionalFiniteNumber(row[scalarMetrics.max]) }
      : {}),
  };
}

function shouldIncludeLocation(requestedLocationKey: string, rowKey: string) {
  return requestedLocationKey === "br"
    ? rowKey === "br" || STATE_KEY_PATTERN.test(rowKey)
    : requestedLocationKey === rowKey;
}

function validatePercentageDistribution(
  source: ResolvedGeeStatisticsSource,
  locationKey: string,
  yearKey: string,
  values: number[],
): boolean {
  if (values.some((value) => value < 0 || value > 100)) {
    throw new Error(
      `Asset estatístico ${source.assetId} possui percentual fora do intervalo 0–100 em ${locationKey}/${yearKey}.`,
    );
  }

  const isAllZero = values.every((value) => value === 0);
  const sum = values.reduce((total, value) => total + value, 0);

  if (!isAllZero && Math.abs(sum - 100) > PERCENTAGE_SUM_TOLERANCE) {
    throw new Error(
      `Asset estatístico ${source.assetId} possui percentuais que somam ${sum} em ${locationKey}/${yearKey}; esperado 100 ± ${PERCENTAGE_SUM_TOLERANCE}.`,
    );
  }

  return !isAllZero;
}

export function mapGeeStatisticsRows(
  source: ResolvedGeeStatisticsSource,
  schema: GeeStatisticsSchema,
  yearKey: string,
  requestedLocationKey: string,
  rows: Record<string, unknown>[],
  classCount: number,
): GeeStatisticsYearResult {
  if (schema.percentageProperties.length !== classCount) {
    throw new Error(
      `Asset estatístico ${source.assetId} possui ${schema.percentageProperties.length} classes, mas a camada possui ${classCount}.`,
    );
  }

  const locations: Record<string, string> = {};
  const values: Record<string, number[]> = {};
  const metrics: Record<string, GeeStatisticsMetrics> = {};
  const omittedZeroValueLocationKeys: string[] = [];
  const seenLocationKeys = new Set<string>();

  for (const row of rows) {
    const location = getLocation(source, row);

    if (!shouldIncludeLocation(requestedLocationKey, location.key)) {
      continue;
    }

    if (seenLocationKeys.has(location.key)) {
      throw new Error(
        `Asset estatístico ${source.assetId} possui localidade duplicada: ${location.key}/${yearKey}.`,
      );
    }
    seenLocationKeys.add(location.key);
    locations[location.key] = location.label;
    metrics[location.key] = getMetrics(source, schema, row);

    const locationValues = schema.percentageProperties.map((property) =>
      toFiniteNumber(row[property], `${location.key}/${yearKey}/${property}`),
    );

    if (
      !validatePercentageDistribution(
        source,
        location.key,
        yearKey,
        locationValues,
      )
    ) {
      omittedZeroValueLocationKeys.push(location.key);
      continue;
    }

    values[location.key] = locationValues;
  }

  return {
    assetId: source.assetId,
    featureCount: rows.length,
    omittedZeroValueLocationKeys,
    patch: {
      locations,
      years: {
        [yearKey]: {
          valuesScale: 1,
          values,
        },
      },
    },
    metrics,
  };
}

function getAggregateLevel(locationKey: string): string | null {
  const prefix = locationKey.match(AGGREGATE_LOCATION_PATTERN)?.[1];
  return prefix ? (SOURCE_LEVEL_BY_LOCATION_PREFIX[prefix] ?? null) : null;
}

function buildPeriodFilter(
  source: ResolvedGeeStatisticsSource,
  yearKey: string,
) {
  if (source.periodGranularity === "month") {
    return ee.Filter.eq(source.properties.date, `${yearKey}-01`);
  }

  return ee.Filter.eq(source.properties.year, Number(yearKey));
}

function buildLocationFilter(
  source: ResolvedGeeStatisticsSource,
  locationKey: string,
) {
  if (locationKey === "br") {
    return ee.Filter.or(
      ee.Filter.eq(source.properties.level, "1_BR"),
      ee.Filter.eq(source.properties.level, "6_Estado"),
    );
  }

  if (MUNICIPALITY_KEY_PATTERN.test(locationKey)) {
    return ee.Filter.and(
      ee.Filter.eq(source.properties.level, "7_Municipio"),
      ee.Filter.eq(source.properties.municipalityCode, locationKey),
    );
  }

  if (STATE_KEY_PATTERN.test(locationKey) && locationKey in statesObj) {
    // Some tables store the state name instead of its acronym in NM_UF. The
    // state slice has only 27 rows, so selecting the requested state after the
    // evaluation keeps the query small without coupling it to that convention.
    return ee.Filter.eq(source.properties.level, "6_Estado");
  }

  const aggregateLevel = getAggregateLevel(locationKey);
  if (aggregateLevel) {
    return ee.Filter.eq(source.properties.level, aggregateLevel);
  }

  throw new Error(`Chave territorial GEE inválida: ${locationKey}.`);
}

async function getGeeStatisticsSchema(
  source: ResolvedGeeStatisticsSource,
): Promise<GeeStatisticsSchema> {
  let propertyNamesPromise = propertyNamesByAssetId.get(source.assetId);
  if (!propertyNamesPromise) {
    propertyNamesPromise = (async () => {
      const collection = ee.FeatureCollection(source.assetId);
      const propertyNames = await evaluateGeeObject<string[]>(
        ee.Feature(collection.first()).propertyNames(),
      );

      if (!Array.isArray(propertyNames)) {
        throw new Error(
          `Não foi possível identificar o schema do asset estatístico ${source.assetId}.`,
        );
      }

      return propertyNames;
    })();
    propertyNamesByAssetId.set(source.assetId, propertyNamesPromise);
  }

  try {
    return inferGeeStatisticsSchema(source, await propertyNamesPromise);
  } catch (error) {
    propertyNamesByAssetId.delete(source.assetId);
    throw error;
  }
}

async function loadGeeStatisticsRows(
  source: ResolvedGeeStatisticsSource,
  schema: GeeStatisticsSchema,
  yearKey: string,
  locationKey: string,
): Promise<Record<string, unknown>[]> {
  const properties = getGeeStatisticsRequestedProperties(source, schema);
  const collection = ee
    .FeatureCollection(source.assetId)
    .filter(buildPeriodFilter(source, yearKey))
    .filter(buildLocationFilter(source, locationKey))
    .map((feature: unknown) =>
      ee.Feature(null, ee.Feature(feature).toDictionary(properties)),
    );
  const result =
    await evaluateGeeObject<EvaluatedFeatureCollection>(collection);

  if (!Array.isArray(result?.features)) {
    throw new Error(
      `Resposta inválida do asset estatístico GEE ${source.assetId}.`,
    );
  }

  return result.features.map((feature) => feature.properties ?? {});
}

export async function getGeeStatisticsYearPatch(
  panelLayerId: string,
  yearKey: string,
  locationKey: string,
  classCount: number,
): Promise<GeeStatisticsYearResult | null> {
  const source = getGeeStatisticsSource(panelLayerId);

  if (!source) {
    return null;
  }

  const resolvedSource = resolveGeeStatisticsSource(source, yearKey);
  await initializeGee();
  const schema = await getGeeStatisticsSchema(resolvedSource);

  if (schema.percentageProperties.length !== classCount) {
    throw new Error(
      `Asset estatístico ${resolvedSource.assetId} possui ${schema.percentageProperties.length} classes, mas a camada possui ${classCount}.`,
    );
  }

  const rows = await loadGeeStatisticsRows(
    resolvedSource,
    schema,
    yearKey,
    locationKey,
  );
  return mapGeeStatisticsRows(
    resolvedSource,
    schema,
    yearKey,
    locationKey,
    rows,
    classCount,
  );
}

export function clearGeeStatisticsSchemaCacheForTests(): void {
  propertyNamesByAssetId.clear();
}
