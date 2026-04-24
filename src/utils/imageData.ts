import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import type {
  IImageParam,
  ImageDataConfig,
  LegacyImageDataEntry,
} from "@/utils/interfaces";

export interface ResolvedImageYearEntry {
  default: boolean;
  year?: string;
  imageId: string;
  imageParams: IImageParam[];
  analysis?: LegacyImageDataEntry["analysis"];
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
  return imageData.classes.map((item) => ({
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
  return Boolean(
    imageData &&
    typeof imageData === "object" &&
    "years" in imageData &&
    "classes" in imageData,
  );
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

    return {
      default: year === getImageDataDefaultYear(imageData),
      year: yearData.year ?? year,
      imageId: yearData.imageId,
      imageParams: buildCompactImageParams(imageData),
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
