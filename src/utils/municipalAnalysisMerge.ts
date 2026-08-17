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
import { validateImageDataContract } from "@/contracts/imageDataContract.mjs";

export type CompactAnalysisYearPatch = Partial<CompactAnalysisYearData> & {
  values?: Record<string, number[]>;
};

export interface CompactTerritorialAnalysisDatasetPatch {
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

function getCalendarYear(yearKey: string) {
  return yearKey.match(/^(\d{4})(?:-\d{2})?$/u)?.[1] ?? null;
}

export function groupPatchYearsByBaseYear(
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

      lookup.set(calendarYear, [
        ...(lookup.get(calendarYear) ?? []),
        baseYearKey,
      ]);

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
      (matchingCalendarBaseYears.length === 1
        ? matchingCalendarBaseYears[0]
        : null);

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

export function mergeAnalysisYear(
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
    ...(baseYear.values ?? {}),
    ...normalizedPatchValues,
  };

  if (Object.keys(mergedValues).length === 0) {
    return null;
  }

  const mergedValuesScale = baseYear.valuesScale ?? patchYear?.valuesScale;

  return {
    imageId: baseYear.imageId,
    ...(baseYear.year ? { year: baseYear.year } : {}),
    ...(typeof mergedValuesScale === "number"
      ? { valuesScale: mergedValuesScale }
      : {}),
    values: mergedValues,
  };
}

export function hasPatchForYear(
  baseYears: Record<string, CompactAnalysisYearData>,
  patchYears: Record<string, CompactAnalysisYearPatch> | undefined,
  yearKey: string,
): boolean {
  return Boolean(
    groupPatchYearsByBaseYear(baseYears, patchYears).get(yearKey)?.length,
  );
}

export function mergeCompactDataset(
  base: CompactTerritorialAnalysisDataset,
  patch: CompactTerritorialAnalysisDatasetPatch,
): CompactTerritorialAnalysisDataset {
  const patchYearsByBaseYear = groupPatchYearsByBaseYear(
    base.years,
    patch.years,
  );

  const years = Object.fromEntries(
    Object.entries(base.years).flatMap(([yearKey, baseYear]) => {
      const mergedYear = (
        patchYearsByBaseYear.get(yearKey) ?? []
      ).reduce<CompactAnalysisYearData>(
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

export function mergeCompactDatasetYear(
  base: CompactTerritorialAnalysisDataset,
  patches: CompactTerritorialAnalysisDatasetPatch[],
  yearKey: string,
): CompactTerritorialAnalysisDataset {
  const selectedBaseYear = base.years[yearKey];

  if (!selectedBaseYear) {
    return {
      ...base,
      years: {},
    };
  }

  const baseWithSelectedYear = {
    ...base,
    years: {
      [yearKey]: selectedBaseYear,
    },
  };
  const requestedCalendarYear = getCalendarYear(yearKey);
  const patchesForSelectedYear = patches.flatMap((patch) => {
    const patchYears = patch.years;

    if (!patchYears) {
      return [];
    }

    const exactPatchYear = patchYears[yearKey];

    if (exactPatchYear) {
      return [
        {
          ...patch,
          years: {
            [yearKey]: exactPatchYear,
          },
        },
      ];
    }

    const calendarCandidates = Object.entries(patchYears).filter(
      ([patchYearKey]) =>
        requestedCalendarYear &&
        getCalendarYear(patchYearKey) === requestedCalendarYear,
    );

    // Preserve the legacy annual-to-monthly fallback only when it is
    // unambiguous. Multiple monthly entries from the same calendar year must
    // never be collapsed into the requested month.
    if (calendarCandidates.length !== 1) {
      return [];
    }

    const [fallbackYearKey, fallbackYear] = calendarCandidates[0];

    return [
      {
        ...patch,
        years: {
          [fallbackYearKey]: fallbackYear,
        },
      },
    ];
  });

  return patchesForSelectedYear.reduce<CompactTerritorialAnalysisDataset>(
    (imageData, patch) => mergeCompactDataset(imageData, patch),
    baseWithSelectedYear,
  );
}

export function mergePartialMunicipalImageData(
  baseImageData: PanelLayerI["imageData"],
  partialImageData: PanelLayerI["imageData"] | null,
): PanelLayerI["imageData"] {
  if (!partialImageData) {
    return baseImageData;
  }

  if (!isCompactImageData(baseImageData)) {
    return partialImageData;
  }

  if (
    !validateImageDataContract(partialImageData, {
      context: "municipalPatch",
    }).ok
  ) {
    return baseImageData;
  }

  return mergeCompactDataset(
    baseImageData,
    partialImageData as CompactTerritorialAnalysisDatasetPatch,
  );
}

export function mergeMultiplePartialMunicipalImageData(
  baseImageData: PanelLayerI["imageData"],
  partialImageDatas: Array<PanelLayerI["imageData"] | null | undefined>,
): PanelLayerI["imageData"] {
  if (!isCompactImageData(baseImageData)) {
    // If not compact, we return the last valid patch, or base if none.
    for (let i = partialImageDatas.length - 1; i >= 0; i--) {
      if (partialImageDatas[i]) {
        return partialImageDatas[i] as PanelLayerI["imageData"];
      }
    }
    return baseImageData;
  }

  const validPatches = partialImageDatas
    .filter(
      (patch) =>
        Boolean(patch) &&
        validateImageDataContract(patch, { context: "municipalPatch" }).ok,
    )
    .map((patch) => patch as unknown as CompactTerritorialAnalysisDatasetPatch);

  if (validPatches.length === 0) {
    return baseImageData;
  }

  const combinedPatch: CompactTerritorialAnalysisDatasetPatch = {};
  for (const patch of validPatches) {
    if (patch.schemaVersion !== undefined) combinedPatch.schemaVersion = patch.schemaVersion;
    if (patch.type) combinedPatch.type = patch.type;
    if (patch.defaultYear) combinedPatch.defaultYear = patch.defaultYear;
    if (patch.classes) combinedPatch.classes = patch.classes;
    if (patch.locations) {
      combinedPatch.locations = { ...(combinedPatch.locations || {}), ...patch.locations };
    }
    if (patch.templates) {
      combinedPatch.templates = { ...(combinedPatch.templates || {}), ...patch.templates };
    }
    if (patch.ranking) {
      combinedPatch.ranking = { ...(combinedPatch.ranking || {}), ...patch.ranking };
    }
    if (patch.mapVisualization) combinedPatch.mapVisualization = patch.mapVisualization;
    if (patch.years) {
      combinedPatch.years = { ...(combinedPatch.years || {}), ...patch.years };
    }
  }

  return mergeCompactDataset(baseImageData, combinedPatch);
}
