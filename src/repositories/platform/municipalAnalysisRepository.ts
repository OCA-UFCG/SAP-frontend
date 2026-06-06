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
): CompactAnalysisYearData | null {
  if (!baseYear) {
    return null;
  }

  const normalizationScale = baseYear.valuesScale ?? 1;
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
    imageId: baseYear.imageId,
    ...(baseYear.year ? { year: baseYear.year } : {}),
    ...(typeof mergedValuesScale === "number"
      ? { valuesScale: mergedValuesScale }
      : {}),
    values: mergedValues,
  };
}

function getCalendarYear(yearKey: string) {
  return yearKey.match(/^(\d{4})(?:-\d{2})?$/u)?.[1] ?? null;
}

function groupPatchYearsByBaseYear(
  baseYears: Record<string, CompactAnalysisYearData>,
  patchYears: Record<string, CompactAnalysisYearPatch> | undefined,
) {
  const patchesByBaseYear = new Map<string, CompactAnalysisYearPatch[]>();

  if (!patchYears) {
    return patchesByBaseYear;
  }

  const baseYearKeys = Object.keys(baseYears);
  const baseYearKeysByCalendarYear = baseYearKeys.reduce(
    (lookup, baseYearKey) => {
      const calendarYear = getCalendarYear(baseYearKey);

      if (!calendarYear) {
        return lookup;
      }

      lookup.set(calendarYear, [...(lookup.get(calendarYear) ?? []), baseYearKey]);

      return lookup;
    },
    new Map<string, string[]>(),
  );

  for (const [patchYearKey, patchYear] of Object.entries(patchYears)) {
    const exactBaseYear = baseYears[patchYearKey] ? patchYearKey : null;
    const calendarYear = getCalendarYear(patchYearKey);
    const matchingCalendarBaseYears = calendarYear
      ? (baseYearKeysByCalendarYear.get(calendarYear) ?? [])
      : [];
    const targetBaseYear =
      exactBaseYear ??
      (matchingCalendarBaseYears.length === 1 ? matchingCalendarBaseYears[0] : null);

    if (!targetBaseYear) {
      continue;
    }

    patchesByBaseYear.set(targetBaseYear, [
      ...(patchesByBaseYear.get(targetBaseYear) ?? []),
      patchYear,
    ]);
  }

  return patchesByBaseYear;
}

function mergeCompactDataset(
  base: CompactTerritorialAnalysisDataset,
  patch: CompactTerritorialAnalysisDatasetPatch,
): CompactTerritorialAnalysisDataset {
  const patchYearsByBaseYear = groupPatchYearsByBaseYear(base.years, patch.years);

  const years = Object.fromEntries(
    Object.entries(base.years).flatMap(([yearKey, baseYear]) => {
      const mergedYear = (patchYearsByBaseYear.get(yearKey) ?? []).reduce(
        (currentYear, patchYear) =>
          mergeAnalysisYear(currentYear, patchYear) ?? currentYear,
        baseYear,
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
    ...(base.defaultYear ? { defaultYear: base.defaultYear } : {}),
    classes: base.classes,
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
    mapVisualization: base.mapVisualization,
    years,
  };
}

async function getMunicipalAnalysisPatches() {
  try {
    const data = await getContent<MunicipalAnalysisResponse>(GET_MUNICIPAL_ANALYSIS);

    return (data.municipalAnalysisCollection?.items ?? []).reduce(
      (patchesByPanelLayer, entry) => {
        if (!entry?.panelLayerId?.trim()) {
          return patchesByPanelLayer;
        }

        const patch = toDatasetPatch(entry.imageData);

        if (!patch) {
          return patchesByPanelLayer;
        }

        const currentPatches = patchesByPanelLayer.get(entry.panelLayerId) ?? [];
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
    return new Map<string, CompactTerritorialAnalysisDatasetPatch>();
  }
}

export async function attachMunicipalAnalysisToPanelLayers(
  panelLayers: PanelLayerI[],
): Promise<PanelLayerI[]> {
  if (panelLayers.length === 0) {
    return panelLayers;
  }

  const municipalAnalysisPatchesByPanelLayer = await getMunicipalAnalysisPatches();

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
      imageData: patches.reduce(
        (imageData, patch) => mergeCompactDataset(imageData, patch),
        layer.imageData,
      ),
    };
  });
}
