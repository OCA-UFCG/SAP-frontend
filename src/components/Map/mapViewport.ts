import type { PaddingOptions } from "maplibre-gl";

export const MAP_FIT_BOUNDS_BASE_PADDING = 200;

const MIN_VISIBLE_MAP_WIDTH = 160;

interface BuildOverlayAwareFitBoundsPaddingOptions {
  basePadding?: number;
  leftOverlayWidth?: number;
  containerWidth?: number;
}

export function buildOverlayAwareFitBoundsPadding({
  basePadding = MAP_FIT_BOUNDS_BASE_PADDING,
  leftOverlayWidth = 0,
  containerWidth,
}: BuildOverlayAwareFitBoundsPaddingOptions): PaddingOptions {
  let resolvedBasePadding = Math.max(0, basePadding);
  let resolvedOverlayWidth = Math.max(0, leftOverlayWidth);

  if (typeof containerWidth === "number" && Number.isFinite(containerWidth)) {
    // Keep a minimum visible sliver of map on small screens by shrinking the
    // generic fit padding before we reduce the sidebar compensation itself.
    const maxHorizontalPadding = Math.max(
      0,
      containerWidth - MIN_VISIBLE_MAP_WIDTH,
    );

    if (resolvedOverlayWidth + resolvedBasePadding * 2 > maxHorizontalPadding) {
      resolvedBasePadding = Math.max(
        0,
        Math.min(
          resolvedBasePadding,
          (maxHorizontalPadding - resolvedOverlayWidth) / 2,
        ),
      );
      resolvedOverlayWidth = Math.min(
        resolvedOverlayWidth,
        Math.max(0, maxHorizontalPadding - resolvedBasePadding * 2),
      );
    }
  }

  return {
    top: resolvedBasePadding,
    right: resolvedBasePadding,
    bottom: resolvedBasePadding,
    left: resolvedBasePadding + resolvedOverlayWidth,
  };
}