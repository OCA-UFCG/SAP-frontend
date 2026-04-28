import type { PaddingOptions } from "maplibre-gl";

export const MAP_FIT_BOUNDS_BASE_PADDING = 200;
export const PLATFORM_SIDEBAR_OVERLAY_SELECTOR =
  "[data-platform-sidebar-overlay]";
export const PLATFORM_SIDE_RAIL_SELECTOR = "[data-platform-side-rail]";
export const PLATFORM_SIDE_PANEL_SELECTOR = "[data-platform-side-panel]";

const MIN_VISIBLE_MAP_WIDTH = 160;

interface BuildOverlayAwareFitBoundsPaddingOptions {
  basePadding?: number;
  leftOverlayWidth?: number;
  containerWidth?: number;
}

interface ResolvedOverlayAwarePadding {
  resolvedBasePadding: number;
  resolvedOverlayWidth: number;
}

function getMeasuredWidth(
  element: Pick<HTMLElement, "getBoundingClientRect"> | null | undefined,
): number {
  const width = element?.getBoundingClientRect().width;

  if (typeof width !== "number" || !Number.isFinite(width)) {
    return 0;
  }

  return Math.max(0, Math.round(width));
}

export function resolvePlatformSidebarOverlayWidth(root: ParentNode): number {
  const sideRail = root.querySelector<HTMLElement>(PLATFORM_SIDE_RAIL_SELECTOR);
  const sidePanel = root.querySelector<HTMLElement>(
    PLATFORM_SIDE_PANEL_SELECTOR,
  );

  if (sideRail || sidePanel) {
    return getMeasuredWidth(sideRail) + getMeasuredWidth(sidePanel);
  }

  return getMeasuredWidth(
    root.querySelector<HTMLElement>(PLATFORM_SIDEBAR_OVERLAY_SELECTOR),
  );
}

function resolveOverlayAwarePadding({
  basePadding = MAP_FIT_BOUNDS_BASE_PADDING,
  leftOverlayWidth = 0,
  containerWidth,
}: BuildOverlayAwareFitBoundsPaddingOptions): ResolvedOverlayAwarePadding {
  let resolvedBasePadding = Math.max(0, basePadding);
  let resolvedOverlayWidth = Math.max(0, leftOverlayWidth);

  if (typeof containerWidth === "number" && Number.isFinite(containerWidth)) {
    // Keep a minimum visible sliver of map on small screens by shrinking the
    // generic fit padding before we reduce sidebar compensation itself.
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
    resolvedBasePadding,
    resolvedOverlayWidth,
  };
}

export function buildOverlayAwareMapPadding(
  options: BuildOverlayAwareFitBoundsPaddingOptions,
): PaddingOptions {
  const { resolvedOverlayWidth } = resolveOverlayAwarePadding(options);

  return {
    top: 0,
    right: 0,
    bottom: 0,
    left: resolvedOverlayWidth,
  };
}

export function buildOverlayAwareFitBoundsPadding({
  basePadding = MAP_FIT_BOUNDS_BASE_PADDING,
  leftOverlayWidth = 0,
  containerWidth,
}: BuildOverlayAwareFitBoundsPaddingOptions): PaddingOptions {
  const { resolvedBasePadding } = resolveOverlayAwarePadding({
    basePadding,
    leftOverlayWidth,
    containerWidth,
  });

  return {
    top: resolvedBasePadding,
    right: resolvedBasePadding,
    bottom: resolvedBasePadding,
    left: resolvedBasePadding,
  };
}
