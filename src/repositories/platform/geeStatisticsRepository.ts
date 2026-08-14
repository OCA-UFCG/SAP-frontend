import "server-only";

import ee from "@google/earthengine";
import type { GeeFeatureCollectionStatisticsSource } from "@/config/geeStatistics";
import { getGeeStatisticsSource } from "@/config/geeStatistics";
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

interface EvaluatedFeature {
  properties?: Record<string, unknown>;
}

interface EvaluatedFeatureCollection {
  features?: EvaluatedFeature[];
}

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
  source: GeeFeatureCollectionStatisticsSource,
  row: Record<string, unknown>,
): string | null {
  const rawStateCode = normalizeText(
    row[source.stateCodeProperty],
  ).toLowerCase();

  if (STATE_KEY_PATTERN.test(rawStateCode) && rawStateCode in statesObj) {
    return rawStateCode;
  }

  const name = normalizeComparableText(row[source.locationNameProperty]);
  return stateCodeByName.get(name) ?? null;
}

function getLocation(
  source: GeeFeatureCollectionStatisticsSource,
  row: Record<string, unknown>,
): { key: string; label: string } {
  const level = normalizeText(row[source.levelProperty]);
  const locationName = normalizeText(row[source.locationNameProperty]);

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
      row[source.municipalityCodeProperty],
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

function getMetrics(row: Record<string, unknown>): GeeStatisticsMetrics {
  const classAreaHa = Array.from({ length: 6 }, (_, index) =>
    toOptionalFiniteNumber(row[`area_ha_classe_${index + 1}`]),
  );

  return {
    areaTotalHa: toOptionalFiniteNumber(row.area_total_ha),
    ...(classAreaHa.some((value) => value !== undefined)
      ? { classAreaHa: classAreaHa.map((value) => value ?? 0) }
      : {}),
    mean: toOptionalFiniteNumber(row.media_Carbono),
    median: toOptionalFiniteNumber(row.mediana_Carbono),
    mode: toOptionalFiniteNumber(row.moda_Carbono),
    min: toOptionalFiniteNumber(row.min_Carbono),
    max: toOptionalFiniteNumber(row.max_Carbono),
  };
}

function shouldIncludeLocation(requestedLocationKey: string, rowKey: string) {
  return requestedLocationKey === "br"
    ? rowKey === "br" || STATE_KEY_PATTERN.test(rowKey)
    : requestedLocationKey === rowKey;
}

export function mapGeeStatisticsRows(
  source: GeeFeatureCollectionStatisticsSource,
  yearKey: string,
  requestedLocationKey: string,
  rows: Record<string, unknown>[],
  classCount: number,
): GeeStatisticsYearResult {
  if (source.classProperties.length !== classCount) {
    throw new Error(
      `Asset estatístico ${source.assetId} possui ${source.classProperties.length} classes, mas a camada possui ${classCount}.`,
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
    metrics[location.key] = getMetrics(row);

    const locationValues = source.classProperties.map((property) =>
      toFiniteNumber(row[property], `${location.key}/${yearKey}/${property}`),
    );

    if (locationValues.every((value) => value === 0)) {
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
  source: GeeFeatureCollectionStatisticsSource,
  yearKey: string,
) {
  if (/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(yearKey)) {
    return ee.Filter.eq(source.dateProperty, `${yearKey}-01`);
  }

  if (/^\d{4}$/u.test(yearKey)) {
    return ee.Filter.eq(source.yearProperty, Number(yearKey));
  }

  throw new Error(`Período GEE inválido: ${yearKey}.`);
}

function buildLocationFilter(
  source: GeeFeatureCollectionStatisticsSource,
  locationKey: string,
) {
  if (locationKey === "br") {
    return ee.Filter.or(
      ee.Filter.eq(source.levelProperty, "1_BR"),
      ee.Filter.eq(source.levelProperty, "6_Estado"),
    );
  }

  if (MUNICIPALITY_KEY_PATTERN.test(locationKey)) {
    return ee.Filter.and(
      ee.Filter.eq(source.levelProperty, "7_Municipio"),
      ee.Filter.eq(source.municipalityCodeProperty, locationKey),
    );
  }

  if (STATE_KEY_PATTERN.test(locationKey) && locationKey in statesObj) {
    // Some tables store the state name instead of its acronym in NM_UF. The
    // state slice has only 27 rows, so selecting the requested state after the
    // evaluation keeps the query small without coupling it to that convention.
    return ee.Filter.eq(source.levelProperty, "6_Estado");
  }

  const aggregateLevel = getAggregateLevel(locationKey);
  if (aggregateLevel) {
    return ee.Filter.eq(source.levelProperty, aggregateLevel);
  }

  throw new Error(`Chave territorial GEE inválida: ${locationKey}.`);
}

function getRequestedProperties(source: GeeFeatureCollectionStatisticsSource) {
  return [
    source.levelProperty,
    source.locationNameProperty,
    source.municipalityCodeProperty,
    source.stateCodeProperty,
    source.yearProperty,
    source.dateProperty,
    ...source.classProperties,
    ...source.metricProperties,
  ];
}

async function loadGeeStatisticsRows(
  source: GeeFeatureCollectionStatisticsSource,
  yearKey: string,
  locationKey: string,
): Promise<Record<string, unknown>[]> {
  await initializeGee();

  const properties = getRequestedProperties(source);
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

  const rows = await loadGeeStatisticsRows(source, yearKey, locationKey);
  return mapGeeStatisticsRows(source, yearKey, locationKey, rows, classCount);
}
