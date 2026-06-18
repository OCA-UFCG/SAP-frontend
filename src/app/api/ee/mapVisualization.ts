import type { CompactMapVisualizationConfig } from "@/utils/analysis";
import type { IImageParam } from "@/utils/interfaces";

export interface ThresholdClassificationPlan {
  outputBand?: string;
  startValue: number;
  thresholds: number[];
}

export interface ResolvedMapVisualizationPlan {
  sourceType?: CompactMapVisualizationConfig["sourceType"];
  property?: string;
  outline?: CompactMapVisualizationConfig["outline"];
  sourceBand?: string;
  thresholdClassification?: ThresholdClassificationPlan;
  visParams: {
    min: number;
    max: number;
    palette: string[];
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getFallbackPalette(imageParams: IImageParam[]) {
  return imageParams
    .map((imageParam) => imageParam.color)
    .filter((color): color is string => typeof color === "string");
}

export function classifyValueByThresholds(
  value: number,
  thresholds: number[],
  startValue: number,
) {
  return thresholds.reduce(
    (currentClass, threshold, index) =>
      value >= threshold ? startValue + index + 1 : currentClass,
    startValue,
  );
}

export function resolveMapVisualizationPlan(
  mapVisualization: CompactMapVisualizationConfig,
  imageParams: IImageParam[],
  minScale: number,
  maxScale: number,
): ResolvedMapVisualizationPlan {
  const thresholds = Array.isArray(mapVisualization.thresholds)
    ? mapVisualization.thresholds.filter(isFiniteNumber)
    : [];
  const hasThresholds = thresholds.length > 0;
  const palette =
    Array.isArray(mapVisualization.palette) &&
    mapVisualization.palette.length > 0
      ? mapVisualization.palette
      : getFallbackPalette(imageParams);
  const min = isFiniteNumber(mapVisualization.min)
    ? mapVisualization.min
    : (minScale ?? 0);
  const max = isFiniteNumber(mapVisualization.max)
    ? mapVisualization.max
    : (maxScale ?? (palette.length > 0 ? min + palette.length - 1 : min));
  const sourceBand = hasThresholds
    ? (mapVisualization.sourceBand ?? mapVisualization.band)
    : (mapVisualization.band ?? mapVisualization.sourceBand);

  return {
    sourceType: mapVisualization.sourceType,
    property: mapVisualization.property,
    outline: mapVisualization.outline,
    sourceBand,
    visParams: { min, max, palette },
    ...(hasThresholds
      ? {
          thresholdClassification: {
            outputBand: mapVisualization.band,
            startValue: min,
            thresholds,
          },
        }
      : {}),
  };
}
