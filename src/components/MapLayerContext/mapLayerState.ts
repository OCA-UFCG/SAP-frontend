import { getImageDataDefaultYear } from "@/utils/imageData";
import type { CDIVectorData } from "@/lib/geo";
import type { IEEInfo, IImageParam } from "@/utils/interfaces";
import {
  DEFAULT_SPATIAL_SELECTION,
  type SpatialSelection,
} from "@/utils/spatialScope";

export type ReferenceLayerId =
  "quilombolas" | "assentamentos" | "terras_indigenas" | "unidades_conservacao";

export const REFERENCE_LAYER_IDS: readonly ReferenceLayerId[] = [
  "quilombolas",
  "assentamentos",
  "terras_indigenas",
  "unidades_conservacao",
] as const;

/**
 * As cores de cada território no mapa, repetidas aqui para que o checkbox de
 * Territórios mostre a mesma cor do território que ele liga. A fonte é o estilo
 * do Earth Engine em `src/app/api/ee/reference-layers/route.ts`: mudar uma cor
 * lá pede mudar aqui. `check` é a cor do ✓ sobre o interior — branco não se lê
 * sobre o cinza-claro dos assentamentos.
 */
export const REFERENCE_LAYER_SWATCHES: Record<
  ReferenceLayerId,
  { outline: string; fill: string; check: string }
> = {
  quilombolas: { outline: "#6D1A36", fill: "#8E2437", check: "#FFFFFF" },
  assentamentos: { outline: "#888888", fill: "#CCCCCC", check: "#3F3F3F" },
  terras_indigenas: { outline: "#6B3E1F", fill: "#8B572A", check: "#FFFFFF" },
  unidades_conservacao: {
    outline: "#1B4D2B",
    fill: "#2E6B3F",
    check: "#FFFFFF",
  },
};

export interface MapLayerState {
  activeData: CDIVectorData | null;
  activeLegend: IImageParam[] | null;
  activeEEData: IEEInfo | null;
  selectedState: string;
  selectedMunicipalityCode: string | null;
  activeLayerId: string | null;
  activeYear: string;
  spatialSelection: SpatialSelection;
  layerOpacity: number;
  referenceOverlays: Set<ReferenceLayerId>;
  highlightedReferenceOverlay: ReferenceLayerId | null;
}

export const DEFAULT_SELECTED_STATE = "br";
export const DEFAULT_ACTIVE_YEAR = "general";

export function createInitialMapLayerState(): MapLayerState {
  return {
    activeData: null,
    activeLegend: null,
    activeEEData: null,
    selectedState: DEFAULT_SELECTED_STATE,
    selectedMunicipalityCode: null,
    activeLayerId: null,
    activeYear: DEFAULT_ACTIVE_YEAR,
    spatialSelection: DEFAULT_SPATIAL_SELECTION,
    layerOpacity: 0.85,
    referenceOverlays: new Set<ReferenceLayerId>(),
    highlightedReferenceOverlay: null,
  };
}

export function setSpatialSelection(
  state: MapLayerState,
  spatialSelection: SpatialSelection,
): MapLayerState {
  return {
    ...state,
    spatialSelection,
  };
}

export function setSelectedStateValue(
  state: MapLayerState,
  selectedState: string,
): MapLayerState {
  return {
    ...state,
    selectedState,
    selectedMunicipalityCode: null,
  };
}

export function setLayerOpacityValue(
  state: MapLayerState,
  layerOpacity: number,
): MapLayerState {
  return {
    ...state,
    layerOpacity,
  };
}

export function setSelectedMunicipalityCodeValue(
  state: MapLayerState,
  selectedMunicipalityCode: string | null,
): MapLayerState {
  return {
    ...state,
    selectedMunicipalityCode,
  };
}

export function setActiveLegendValue(
  state: MapLayerState,
  activeLegend: IImageParam[] | null,
): MapLayerState {
  return {
    ...state,
    activeLegend,
  };
}

export function setActiveYearValue(
  state: MapLayerState,
  activeYear: string,
): MapLayerState {
  return {
    ...state,
    activeYear,
  };
}

export function activateVectorLayerState(
  state: MapLayerState,
  layerId: string,
  activeData: CDIVectorData,
  activeLegend: IImageParam[] | null,
): MapLayerState {
  return {
    ...state,
    activeData,
    activeLegend,
    activeEEData: null,
    activeLayerId: layerId,
    activeYear: DEFAULT_ACTIVE_YEAR,
  };
}

export function activateEeLayerState(
  state: MapLayerState,
  activeEEData: IEEInfo,
  activeLegend: IImageParam[] | null,
): MapLayerState {
  return {
    ...state,
    activeData: null,
    activeLegend,
    activeEEData,
    activeLayerId: activeEEData.id,
    activeYear:
      getImageDataDefaultYear(activeEEData.imageData) ?? DEFAULT_ACTIVE_YEAR,
  };
}

export function clearActiveLayerState(state: MapLayerState): MapLayerState {
  return {
    ...state,
    activeData: null,
    activeLegend: null,
    activeEEData: null,
    activeLayerId: null,
    activeYear: DEFAULT_ACTIVE_YEAR,
  };
}

/**
 * Os territórios ligados e o grupo em destaque andam juntos: destacar um grupo
 * desligado também o liga, e desligar o grupo em destaque tira o destaque.
 * Monitoramento guarda isso no estado do mapa e a AMFE num estado próprio, mas
 * as regras são as mesmas — por isso as funções aceitam qualquer objeto com os
 * dois campos.
 */
export interface ReferenceOverlaySelection {
  referenceOverlays: Set<ReferenceLayerId>;
  highlightedReferenceOverlay: ReferenceLayerId | null;
}

export function toggleReferenceOverlayValue<
  T extends ReferenceOverlaySelection,
>(state: T, layerId: ReferenceLayerId): T {
  const next = new Set(state.referenceOverlays);
  if (next.has(layerId)) {
    next.delete(layerId);
  } else {
    next.add(layerId);
  }
  return {
    ...state,
    referenceOverlays: next,
    highlightedReferenceOverlay:
      state.highlightedReferenceOverlay === layerId && !next.has(layerId)
        ? null
        : state.highlightedReferenceOverlay,
  };
}

/**
 * Liga ou desliga o destaque de um grupo. Só um grupo fica em destaque por vez:
 * destacar outro troca o destaque.
 *
 * toggleReferenceHighlightValue(state, "terras_indigenas");
 */
export function toggleReferenceHighlightValue<
  T extends ReferenceOverlaySelection,
>(state: T, layerId: ReferenceLayerId): T {
  if (state.highlightedReferenceOverlay === layerId) {
    return { ...state, highlightedReferenceOverlay: null };
  }

  const referenceOverlays = state.referenceOverlays.has(layerId)
    ? state.referenceOverlays
    : new Set(state.referenceOverlays).add(layerId);
  return { ...state, referenceOverlays, highlightedReferenceOverlay: layerId };
}

export function resetPlatformState(state: MapLayerState): MapLayerState {
  return {
    ...clearActiveLayerState(state),
    selectedState: DEFAULT_SELECTED_STATE,
    selectedMunicipalityCode: null,
    spatialSelection: DEFAULT_SPATIAL_SELECTION,
    referenceOverlays: new Set<ReferenceLayerId>(),
    highlightedReferenceOverlay: null,
  };
}
