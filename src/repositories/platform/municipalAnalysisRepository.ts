import { getContent } from "@/infrastructure/contentful/client";
import { gunzipSync } from "node:zlib";
import type {
  CompactAnalysisYearData,
  CompactTerritorialAnalysisDataset,
} from "@/utils/analysis";
import type { PanelLayerI } from "@/utils/interfaces";
import { isCompactImageData } from "@/utils/imageData";
import {
  mergeCompactDataset,
  mergeCompactDatasetYear,
  hasPatchForYear,
  type CompactAnalysisYearPatch,
  type CompactTerritorialAnalysisDatasetPatch,
} from "@/utils/municipalAnalysisMerge";

const GET_MUNICIPAL_ANALYSIS = `
  query GetMunicipalAnalysis($limit: Int!, $skip: Int!) {
    municipalAnalysisCollection(limit: $limit, skip: $skip) {
      total
      items {
        sys {
          id
        }
        title
        panelLayerId
        imageData
      }
    }
  }
`;

const GET_MUNICIPAL_ANALYSIS_BY_PANEL_LAYER = `
  query GetMunicipalAnalysisByPanelLayer($limit: Int!, $skip: Int!, $panelLayerId: String!) {
    municipalAnalysisCollection(
      limit: $limit
      skip: $skip
      where: { panelLayerId: $panelLayerId }
    ) {
      total
      items {
        sys {
          id
        }
        title
        panelLayerId
        imageData
      }
    }
  }
`;

const GET_MUNICIPAL_ANALYSIS_BY_PANEL_LAYER_AND_PARTITION = `
  query GetMunicipalAnalysisByPanelLayerAndPartition($limit: Int!, $skip: Int!, $panelLayerId: String!, $partitionKey: String!) {
    municipalAnalysisCollection(
      limit: $limit
      skip: $skip
      where: { panelLayerId: $panelLayerId, partitionKey: $partitionKey }
    ) {
      total
      items {
        sys {
          id
        }
        title
        panelLayerId
        partitionKey
        calendarYear
        territory
        imageData
      }
    }
  }
`;

export interface MunicipalAnalysisEntry {
  sys: {
    id: string;
  };
  title?: string | null;
  panelLayerId?: string | null;
  partitionKey?: string | null;
  calendarYear?: string | null;
  territory?: string | null;
  imageData?: unknown;
}

interface MunicipalAnalysisResponse {
  municipalAnalysisCollection?: {
    total?: number;
    items: Array<MunicipalAnalysisEntry | null>;
  };
}

const MUNICIPAL_ANALYSIS_PAGE_SIZE = 100;

interface CompressedTerritorialAnalysisPayload {
  schemaVersion?: number;
  type: "territorial-compact-compressed";
  encoding: "gzip+base64";
  mediaType?: string;
  rawBytes?: number;
  compressedBytes?: number;
  chunkSize?: number;
  data: string | string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return (
    isRecord(value) &&
    Object.values(value).every((entry) => typeof entry === "string")
  );
}

function isNumericArrayRecord(
  value: unknown,
): value is Record<string, number[]> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) =>
        Array.isArray(entry) && entry.every((item) => typeof item === "number"),
    )
  );
}

function isCompressedTerritorialAnalysisPayload(
  value: unknown,
): value is CompressedTerritorialAnalysisPayload {
  return (
    isRecord(value) &&
    value.type === "territorial-compact-compressed" &&
    value.encoding === "gzip+base64" &&
    (typeof value.data === "string" ||
      (Array.isArray(value.data) &&
        value.data.every((chunk) => typeof chunk === "string")))
  );
}

export function decodeMunicipalAnalysisImageData(value: unknown): unknown {
  if (!isCompressedTerritorialAnalysisPayload(value)) {
    return value;
  }

  try {
    const encoded = Array.isArray(value.data)
      ? value.data.join("")
      : value.data;

    return JSON.parse(
      gunzipSync(Buffer.from(encoded, "base64")).toString("utf8"),
    );
  } catch (error) {
    console.warn(
      "municipalAnalysis comprimido inválido; entrada ignorada.",
      error,
    );
    return null;
  }
}

export function toDatasetPatch(
  value: unknown,
): CompactTerritorialAnalysisDatasetPatch | null {
  value = decodeMunicipalAnalysisImageData(value);

  if (!isRecord(value)) {
    return null;
  }

  const patch: CompactTerritorialAnalysisDatasetPatch = {};

  if (typeof value.schemaVersion === "number") {
    patch.schemaVersion = value.schemaVersion;
  }

  if (value.type === "territorial-compact") {
    patch.type = value.type;
  }

  if (typeof value.defaultYear === "string") {
    patch.defaultYear = value.defaultYear;
  }

  if (Array.isArray(value.classes)) {
    patch.classes =
      value.classes as CompactTerritorialAnalysisDatasetPatch["classes"];
  }

  if (isStringRecord(value.locations)) {
    patch.locations = value.locations;
  }

  if (isRecord(value.templates)) {
    patch.templates =
      value.templates as CompactTerritorialAnalysisDatasetPatch["templates"];
  }

  if (isRecord(value.ranking)) {
    patch.ranking =
      value.ranking as CompactTerritorialAnalysisDatasetPatch["ranking"];
  }

  if (isRecord(value.mapVisualization)) {
    patch.mapVisualization =
      value.mapVisualization as CompactTerritorialAnalysisDatasetPatch["mapVisualization"];
  }

  if (isRecord(value.years)) {
    patch.years = Object.fromEntries(
      Object.entries(value.years).flatMap(([yearKey, yearValue]) => {
        if (!isRecord(yearValue)) {
          return [];
        }

        const yearPatch: CompactAnalysisYearPatch = {};

        if (typeof yearValue.imageId === "string") {
          yearPatch.imageId = yearValue.imageId;
        }

        if (typeof yearValue.year === "string") {
          yearPatch.year = yearValue.year;
        }

        if (typeof yearValue.valuesScale === "number") {
          yearPatch.valuesScale = yearValue.valuesScale;
        }

        if (isNumericArrayRecord(yearValue.values)) {
          yearPatch.values = yearValue.values;
        }

        return [[yearKey, yearPatch]];
      }),
    );
  }

  return patch;
}

function getCalendarYear(yearKey: string) {
  return yearKey.match(/^(\d{4})(?:-\d{2})?$/u)?.[1] ?? null;
}

function buildPartitionTitle(
  panelLayerId: string,
  partitionKey: string,
): string {
  return `Municipal Analysis ${panelLayerId} ${partitionKey}`;
}

function getPartitionKeyForYear(
  baseYears: Record<string, CompactAnalysisYearData>,
  yearKey: string,
): string {
  const calendarYear = getCalendarYear(yearKey);
  const baseYearKeysForCalendarYear = Object.keys(baseYears).filter(
    (baseYearKey) => getCalendarYear(baseYearKey) === calendarYear,
  );

  if (
    calendarYear &&
    baseYearKeysForCalendarYear.length === 1 &&
    baseYearKeysForCalendarYear[0] === calendarYear
  ) {
    return calendarYear;
  }

  return yearKey;
}

async function getMunicipalAnalysisEntries(
  query: string,
  variables: Record<string, unknown>,
): Promise<Array<MunicipalAnalysisEntry | null>> {
  const items: Array<MunicipalAnalysisEntry | null> = [];

  for (let skip = 0; ; skip += MUNICIPAL_ANALYSIS_PAGE_SIZE) {
    const data = await getContent<MunicipalAnalysisResponse>(
      query,
      {
        limit: MUNICIPAL_ANALYSIS_PAGE_SIZE,
        skip,
        ...variables,
      },
      { cache: "no-store" },
    );
    const collection = data.municipalAnalysisCollection;

    if (!collection || !Array.isArray(collection.items)) {
      throw new Error(
        `Resposta municipalAnalysis inválida no Contentful na página skip=${skip}.`,
      );
    }

    const pageItems = collection.items;
    const total =
      typeof collection.total === "number" && Number.isFinite(collection.total)
        ? collection.total
        : pageItems.length;

    items.push(...pageItems);

    if (items.length >= total || pageItems.length === 0) {
      break;
    }
  }

  return items;
}

export function entryMatchesPartition(
  entry: MunicipalAnalysisEntry | null,
  panelLayerId: string,
  partitionKey: string,
): boolean {
  if (!entry || entry.panelLayerId !== panelLayerId) {
    return false;
  }

  return (
    entry.partitionKey === partitionKey ||
    entry.title === buildPartitionTitle(panelLayerId, partitionKey)
  );
}

async function getMunicipalAnalysisPatches(
  panelLayerId?: string,
): Promise<Map<string, CompactTerritorialAnalysisDatasetPatch[]>> {
  try {
    const query = panelLayerId
      ? GET_MUNICIPAL_ANALYSIS_BY_PANEL_LAYER
      : GET_MUNICIPAL_ANALYSIS;
    const items = await getMunicipalAnalysisEntries(
      query,
      panelLayerId ? { panelLayerId } : {},
    );

    return items.reduce<Map<string, CompactTerritorialAnalysisDatasetPatch[]>>(
      (patchesByPanelLayer, entry) => {
        if (!entry?.panelLayerId?.trim()) {
          return patchesByPanelLayer;
        }

        const patch = toDatasetPatch(entry.imageData);

        if (!patch) {
          return patchesByPanelLayer;
        }

        const currentPatches =
          patchesByPanelLayer.get(entry.panelLayerId) ?? [];
        patchesByPanelLayer.set(entry.panelLayerId, [...currentPatches, patch]);

        return patchesByPanelLayer;
      },
      new Map<string, CompactTerritorialAnalysisDatasetPatch[]>(),
    );
  } catch (error) {
    console.warn(
      "Coleção municipalAnalysis indisponível ou inválida no Contentful; mantendo apenas os dados base das camadas.",
      error,
    );
    return new Map<string, CompactTerritorialAnalysisDatasetPatch[]>();
  }
}

async function getMunicipalAnalysisPatchesForPartition(
  panelLayerId: string,
  partitionKey: string,
  baseYears: Record<string, CompactAnalysisYearData>,
  yearKey: string,
): Promise<CompactTerritorialAnalysisDatasetPatch[]> {
  try {
    const entries = await getMunicipalAnalysisEntries(
      GET_MUNICIPAL_ANALYSIS_BY_PANEL_LAYER_AND_PARTITION,
      { panelLayerId, partitionKey },
    );
    const patches = entries
      .filter((entry) => entry?.panelLayerId === panelLayerId)
      .flatMap((entry) => {
        const patch = toDatasetPatch(entry?.imageData);

        return patch ? [patch] : [];
      });

    if (patches.length > 0) {
      return patches;
    }
  } catch {
    // Environments published before partition metadata exists fall back to
    // matching by the standardized entry title below.
  }

  const entries = await getMunicipalAnalysisEntries(
    GET_MUNICIPAL_ANALYSIS_BY_PANEL_LAYER,
    { panelLayerId },
  );
  const partitionMatches = entries.filter((entry) =>
    entryMatchesPartition(entry, panelLayerId, partitionKey),
  );
  const candidates = partitionMatches.length > 0 ? partitionMatches : entries;

  return candidates.flatMap((entry) => {
    if (entry?.panelLayerId !== panelLayerId) {
      return [];
    }

    const patch = toDatasetPatch(entry.imageData);

    if (!patch || !hasPatchForYear(baseYears, patch.years, yearKey)) {
      return [];
    }

    return [patch];
  });
}

export async function attachMunicipalAnalysisToPanelLayers(
  panelLayers: PanelLayerI[],
): Promise<PanelLayerI[]> {
  if (panelLayers.length === 0) {
    return panelLayers;
  }

  const municipalAnalysisPatchesByPanelLayer =
    await getMunicipalAnalysisPatches();

  if (municipalAnalysisPatchesByPanelLayer.size === 0) {
    return panelLayers;
  }

  return panelLayers.map((layer) => {
    const patches = municipalAnalysisPatchesByPanelLayer.get(layer.id);

    if (!patches?.length || !isCompactImageData(layer.imageData)) {
      return layer;
    }

    return {
      ...layer,
      imageData: patches.reduce<CompactTerritorialAnalysisDataset>(
        (imageData, patch) => mergeCompactDataset(imageData, patch),
        layer.imageData,
      ),
    };
  });
}

export async function attachMunicipalAnalysisToPanelLayer(
  panelLayer: PanelLayerI,
): Promise<PanelLayerI> {
  const municipalAnalysisPatchesByPanelLayer =
    await getMunicipalAnalysisPatches(panelLayer.id);
  const patches = municipalAnalysisPatchesByPanelLayer.get(panelLayer.id);

  if (!patches?.length || !isCompactImageData(panelLayer.imageData)) {
    return panelLayer;
  }

  return {
    ...panelLayer,
    imageData: patches.reduce<CompactTerritorialAnalysisDataset>(
      (imageData, patch) => mergeCompactDataset(imageData, patch),
      panelLayer.imageData,
    ),
  };
}

export async function attachMunicipalAnalysisYearToPanelLayer(
  panelLayer: PanelLayerI,
  yearKey: string,
): Promise<PanelLayerI> {
  if (!isCompactImageData(panelLayer.imageData)) {
    return panelLayer;
  }

  if (!panelLayer.imageData.years[yearKey]) {
    return {
      ...panelLayer,
      imageData: {
        ...panelLayer.imageData,
        years: {},
      },
    };
  }

  const partitionKey = getPartitionKeyForYear(
    panelLayer.imageData.years,
    yearKey,
  );
  const patches = await getMunicipalAnalysisPatchesForPartition(
    panelLayer.id,
    partitionKey,
    panelLayer.imageData.years,
    yearKey,
  );

  return {
    ...panelLayer,
    imageData: mergeCompactDatasetYear(panelLayer.imageData, patches, yearKey),
  };
}
