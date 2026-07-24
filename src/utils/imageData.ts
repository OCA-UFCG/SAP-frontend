import type {
  CompactMapVisualizationConfig,
  CompactTerritorialAnalysisDataset,
} from "@/utils/analysis";
import type {
  IImageParam,
  ImageDataConfig,
  LegacyImageDataEntry,
} from "@/utils/interfaces";
import { isCompactTerritorialImageData } from "@/contracts/imageDataContract.mjs";

const FUTURE_ONLY_PANEL_LAYER_ID = "prev_anomalia_precipitacao";
const FORECAST_TIME_ZONE = "America/Sao_Paulo";

export interface ResolvedImageYearEntry {
  default: boolean;
  year?: string;
  imageId: string;
  imageParams: IImageParam[];
  analysis?: LegacyImageDataEntry["analysis"];
  mapVisualization?: CompactMapVisualizationConfig;
}

function sortYearKeys(keys: string[]): string[] {
  return [...keys].sort((left, right) => {
    const leftNumber = Number(left);
    const rightNumber = Number(right);
    const bothNumeric =
      Number.isFinite(leftNumber) && Number.isFinite(rightNumber);

    if (bothNumeric) {
      return leftNumber - rightNumber;
    }

    if (left === "general") return -1;
    if (right === "general") return 1;

    return left.localeCompare(right);
  });
}

function buildCompactImageParams(
  imageData: CompactTerritorialAnalysisDataset,
): IImageParam[] {
  const legend = imageData.mapVisualization?.legend ?? imageData.classes;

  return legend.map((item) => ({
    color: item.color,
    label: item.label,
    ...(typeof item.pixelLimit === "number"
      ? { pixelLimit: item.pixelLimit }
      : {}),
  }));
}

export function isCompactImageData(
  imageData: ImageDataConfig | null | undefined,
): imageData is CompactTerritorialAnalysisDataset {
  return isCompactTerritorialImageData(imageData);
}

export function getImageDataYearKeys(
  imageData: ImageDataConfig | null | undefined,
): string[] {
  if (!imageData) {
    return [];
  }

  return sortYearKeys(
    isCompactImageData(imageData)
      ? Object.keys(imageData.years)
      : Object.keys(imageData),
  );
}

export function keepOnlyFutureForecastPeriods(
  panelLayerId: string,
  imageData: ImageDataConfig,
  currentDate = new Date(),
): ImageDataConfig {
  if (
    panelLayerId !== FUTURE_ONLY_PANEL_LAYER_ID ||
    !isCompactImageData(imageData)
  ) {
    return imageData;
  }

  const currentMonthParts = new Intl.DateTimeFormat("en-US", {
    timeZone: FORECAST_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(currentDate);
  const currentYear = currentMonthParts.find(
    (part) => part.type === "year",
  )?.value;
  const currentMonth = currentMonthParts.find(
    (part) => part.type === "month",
  )?.value;
  const currentMonthKey = `${currentYear}-${currentMonth}`;
  const futureYears = Object.fromEntries(
    Object.entries(imageData.years).filter(
      ([yearKey]) =>
        /^\d{4}-(?:0[1-9]|1[0-2])$/u.test(yearKey) && yearKey > currentMonthKey,
    ),
  );
  const futureYearKeys = sortYearKeys(Object.keys(futureYears));
  const defaultYear =
    imageData.defaultYear && futureYears[imageData.defaultYear]
      ? imageData.defaultYear
      : futureYearKeys.at(-1);

  return {
    ...imageData,
    ...(defaultYear ? { defaultYear } : { defaultYear: undefined }),
    years: futureYears,
  };
}

export function getImageDataDefaultYear(
  imageData: ImageDataConfig | null | undefined,
): string | null {
  const years = getImageDataYearKeys(imageData);

  if (years.length === 0 || !imageData) {
    return null;
  }

  if (isCompactImageData(imageData)) {
    if (imageData.defaultYear && imageData.years[imageData.defaultYear]) {
      return imageData.defaultYear;
    }

    return years[0] ?? null;
  }

  const defaultFromFlag = years.find((year) => imageData[year]?.default);

  return (
    defaultFromFlag ??
    (years.includes("general") ? "general" : (years[0] ?? null))
  );
}

export function resolveImageYearEntry(
  imageData: ImageDataConfig | null | undefined,
  year: string,
): ResolvedImageYearEntry | null {
  if (!imageData) {
    return null;
  }

  if (isCompactImageData(imageData)) {
    const yearData = imageData.years[year];

    if (!yearData) {
      return null;
    }

    const resolvedYear = yearData.year ?? year;

    return {
      default: year === getImageDataDefaultYear(imageData),
      year: resolvedYear,
      imageId: yearData.imageId,
      imageParams: buildCompactImageParams(imageData),
      mapVisualization: resolveMapVisualizationForYear(
        imageData.mapVisualization,
        resolvedYear,
      ),
    };
  }

  const yearData = imageData[year];

  if (!yearData) {
    return null;
  }

  return {
    default: Boolean(yearData.default),
    year: yearData.year,
    imageId: yearData.imageId,
    imageParams: yearData.imageParams,
    analysis: yearData.analysis,
  };
}

function replaceYearToken(value: string | undefined, year: string) {
  return value?.replace(/\{year\}/gu, year);
}

function resolveMapVisualizationForYear(
  mapVisualization: CompactMapVisualizationConfig | undefined,
  year: string,
): CompactMapVisualizationConfig | undefined {
  if (!mapVisualization) {
    return undefined;
  }

  return {
    ...mapVisualization,
    property: replaceYearToken(mapVisualization.property, year),
    sourceBand: replaceYearToken(mapVisualization.sourceBand, year),
    band: replaceYearToken(mapVisualization.band, year),
  };
}

export function getImageDataLegend(
  imageData: ImageDataConfig | null | undefined,
  year?: string | null,
): IImageParam[] | null {
  const effectiveYear = year ?? getImageDataDefaultYear(imageData);

  if (!effectiveYear) {
    return null;
  }

  return resolveImageYearEntry(imageData, effectiveYear)?.imageParams ?? null;
}
