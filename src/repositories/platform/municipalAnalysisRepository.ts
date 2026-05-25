import { getContent } from "@/infrastructure/contentful/client";
import type {
  CompactAnalysisClass,
  CompactAnalysisRankingConfig,
  CompactAnalysisTemplates,
  CompactAnalysisYearData,
  CompactMapVisualizationConfig,
  CompactTerritorialAnalysisDataset,
} from "@/utils/analysis";
import type { PanelLayerI } from "@/utils/interfaces";
import { isCompactImageData } from "@/utils/imageData";

const GET_MUNICIPAL_ANALYSIS = `
  query GetMunicipalAnalysis {
    municipalAnalysisCollection {
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

interface MunicipalAnalysisEntry {
  sys: {
    id: string;
  };
  title?: string | null;
  panelLayerId?: string | null;
  imageData?: unknown;
}

interface MunicipalAnalysisResponse {
  municipalAnalysisCollection?: {
    items: Array<MunicipalAnalysisEntry | null>;
  };
}

type CompactAnalysisYearPatch = Partial<CompactAnalysisYearData> & {
  values?: Record<string, number[]>;
};

interface CompactTerritorialAnalysisDatasetPatch {
  schemaVersion?: number;
  type?: "territorial-compact";
  defaultYear?: string;
  classes?: CompactAnalysisClass[];
  locations?: Record<string, string>;
  templates?: CompactAnalysisTemplates;
  ranking?: CompactAnalysisRankingConfig;
  mapVisualization?: CompactMapVisualizationConfig;
  years?: Record<string, CompactAnalysisYearPatch>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}

function isNumericArrayRecord(value: unknown): value is Record<string, number[]> {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (entry) => Array.isArray(entry) && entry.every((item) => typeof item === "number"),
    )
  );
}

function toDatasetPatch(value: unknown): CompactTerritorialAnalysisDatasetPatch | null {
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
    patch.classes = value.classes as CompactAnalysisClass[];
  }

  if (isStringRecord(value.locations)) {
    patch.locations = value.locations;
  }

  if (isRecord(value.templates)) {
    patch.templates = value.templates as CompactAnalysisTemplates;
  }

  if (isRecord(value.ranking)) {
    patch.ranking = value.ranking as CompactAnalysisRankingConfig;
  }

  if (isRecord(value.mapVisualization)) {
    patch.mapVisualization = value.mapVisualization as CompactMapVisualizationConfig;
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

function mergeAnalysisYear(
  baseYear: CompactAnalysisYearData | undefined,
  patchYear: CompactAnalysisYearPatch | undefined,
  yearKey: string,
): CompactAnalysisYearData | null {
  const normalizationScale = baseYear
    ? (baseYear.valuesScale ?? 1)
    : (patchYear?.valuesScale ?? 1);
  const normalizedPatchValues = Object.fromEntries(
    Object.entries(patchYear?.values ?? {}).map(([locationKey, values]) => {
      const patchScale = patchYear?.valuesScale ?? 1;

      if (patchScale === normalizationScale) {
        return [locationKey, values];
      }

      return [
        locationKey,
        values.map((value) =>
          Number(((value * normalizationScale) / patchScale).toFixed(4)),
        ),
      ];
    }),
  );
  const mergedValues = {
    ...(baseYear?.values ?? {}),
    ...normalizedPatchValues,
  };

  if (Object.keys(mergedValues).length === 0) {
    return null;
  }

  const mergedValuesScale = baseYear?.valuesScale ?? patchYear?.valuesScale;

  return {
    imageId:
      patchYear?.imageId?.trim() ||
      baseYear?.imageId ||
      `municipal-analysis://${yearKey}`,
    ...(patchYear?.year ?? baseYear?.year
      ? { year: patchYear?.year ?? baseYear?.year }
      : {}),
    ...(typeof mergedValuesScale === "number"
      ? { valuesScale: mergedValuesScale }
      : {}),
    values: mergedValues,
  };
}

function mergeCompactDataset(
  base: CompactTerritorialAnalysisDataset,
  patch: CompactTerritorialAnalysisDatasetPatch,
): CompactTerritorialAnalysisDataset {
  const yearKeys = new Set([
    ...Object.keys(base.years),
    ...Object.keys(patch.years ?? {}),
  ]);

  const years = Object.fromEntries(
    Array.from(yearKeys).flatMap((yearKey) => {
      const mergedYear = mergeAnalysisYear(
        base.years[yearKey],
        patch.years?.[yearKey],
        yearKey,
      );

      return mergedYear ? [[yearKey, mergedYear]] : [];
    }),
  );

  return {
    ...base,
    ...(typeof patch.schemaVersion === "number"
      ? { schemaVersion: patch.schemaVersion }
      : {}),
    type: "territorial-compact",
    ...(patch.defaultYear ? { defaultYear: patch.defaultYear } : {}),
    classes:
      Array.isArray(patch.classes) && patch.classes.length > 0
        ? patch.classes
        : base.classes,
    locations: {
      ...(base.locations ?? {}),
      ...(patch.locations ?? {}),
    },
    templates:
      patch.templates || base.templates
        ? {
            ...(base.templates ?? {}),
            ...(patch.templates ?? {}),
          }
        : undefined,
    ranking:
      patch.ranking || base.ranking
        ? {
            ...(base.ranking ?? {}),
            ...(patch.ranking ?? {}),
          }
        : undefined,
    mapVisualization:
      patch.mapVisualization || base.mapVisualization
        ? {
            ...(base.mapVisualization ?? {}),
            ...(patch.mapVisualization ?? {}),
          }
        : undefined,
    years,
  };
}

async function getMunicipalAnalysisPatches() {
  try {
    const data = await getContent<MunicipalAnalysisResponse>(GET_MUNICIPAL_ANALYSIS);

    return new Map(
      (data.municipalAnalysisCollection?.items ?? [])
        .flatMap((entry) => {
          if (!entry?.panelLayerId?.trim()) {
            return [];
          }

          const patch = toDatasetPatch(entry.imageData);

          if (!patch) {
            return [];
          }

          return [[entry.panelLayerId, patch] as const];
        }),
    );
  } catch (error) {
    console.warn(
      "Coleção municipalAnalysis indisponível ou inválida no Contentful; mantendo apenas os dados base das camadas.",
      error,
    );
    return new Map<string, CompactTerritorialAnalysisDatasetPatch>();
  }
}

export async function attachMunicipalAnalysisToPanelLayers(
  panelLayers: PanelLayerI[],
): Promise<PanelLayerI[]> {
  if (panelLayers.length === 0) {
    return panelLayers;
  }

  const municipalAnalysisPatches = await getMunicipalAnalysisPatches();

  if (municipalAnalysisPatches.size === 0) {
    return panelLayers;
  }

  return panelLayers.map((layer) => {
    const patch = municipalAnalysisPatches.get(layer.id);

    if (!patch || !isCompactImageData(layer.imageData)) {
      return layer;
    }

    return {
      ...layer,
      imageData: mergeCompactDataset(layer.imageData, patch),
    };
  });
}