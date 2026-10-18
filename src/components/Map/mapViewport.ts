import type { PaddingOptions } from "maplibre-gl";
import { isPhoneViewport } from "@/components/PlatformMap/platformMapView";

export const MAP_FIT_BOUNDS_BASE_PADDING = 200;
/** No celular a tela inteira é mapa: basta não encostar o contorno na borda. */
export const PHONE_FIT_BOUNDS_PADDING = 16;
export const PLATFORM_SIDEBAR_OVERLAY_SELECTOR =
  "[data-platform-sidebar-overlay]";
export const PLATFORM_SIDE_RAIL_SELECTOR = "[data-platform-side-rail]";
export const PLATFORM_SIDE_PANEL_SELECTOR = "[data-platform-side-panel]";

const MIN_VISIBLE_MAP_WIDTH = 160;
const MIN_VISIBLE_MAP_HEIGHT = 160;

interface BuildOverlayAwareFitBoundsPaddingOptions {
  basePadding?: number;
  leftOverlayWidth?: number;
  containerWidth?: number;
}

interface BuildOverlayAwareMapPaddingOptions
  extends BuildOverlayAwareFitBoundsPaddingOptions {
  containerHeight?: number;
  /** O que os controles cobrem embaixo; no computador fica em zero. */
  bottomOverlayHeight?: number;
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
  // No celular a trilha vira a barra de baixo e o painel cobre o mapa inteiro
  // ou nada dele: nenhum dos dois fica à esquerda do mapa. Contar a largura
  // deles empurrava o Brasil para uma faixa de 160px na borda direita.
  if (isPhoneViewport()) {
    return 0;
  }

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

export function buildOverlayAwareMapPadding({
  containerHeight,
  bottomOverlayHeight = 0,
  ...options
}: BuildOverlayAwareMapPaddingOptions): PaddingOptions {
  const { resolvedOverlayWidth } = resolveOverlayAwarePadding(options);
  let bottom = Math.max(0, bottomOverlayHeight);
  if (typeof containerHeight === "number" && Number.isFinite(containerHeight)) {
    bottom = Math.min(bottom, Math.max(0, containerHeight - MIN_VISIBLE_MAP_HEIGHT));
  }

  return {
    top: 0,
    right: 0,
    bottom,
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
