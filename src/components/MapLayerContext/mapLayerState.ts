import { getImageDataDefaultYear } from "@/utils/imageData";
import type { CDIVectorData } from "@/lib/geo";
import type { IEEInfo, IImageParam } from "@/utils/interfaces";

export interface MapLayerState {
  activeData: CDIVectorData | null;
  activeLegend: IImageParam[] | null;
  activeEEData: IEEInfo | null;
  selectedState: string;
  selectedMunicipalityCode: string | null;
  activeLayerId: string | null;
  activeYear: string;
  layerOpacity: number;
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
    layerOpacity: 0.85
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

export function resetPlatformState(state: MapLayerState): MapLayerState {
  return {
    ...clearActiveLayerState(state),
    selectedState: DEFAULT_SELECTED_STATE,
    selectedMunicipalityCode: null,
  };
}
