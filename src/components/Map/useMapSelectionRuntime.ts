import maplibregl, { LngLatBoundsLike } from "maplibre-gl";
import type { MutableRefObject } from "react";
import { type MapMode } from "./mapDefinitions";
import { buildCdiGeoJson } from "./mapBounds";
import { useMapLayerSync } from "./useMapLayerSync";
import { useMunicipalitySelection } from "./useMunicipalitySelection";
import { useStateFeatureSelection } from "./useStateFeatureSelection";

interface UseMapSelectionRuntimeArgs {
  debugEnabled: boolean;
  mapDebugIdRef: MutableRefObject<string>;
  mapRef: MutableRefObject<maplibregl.Map | null>;
  mapModeRef: MutableRefObject<MapMode>;
  selectedStateRef: MutableRefObject<string>;
  selectedStateIdRef: MutableRefObject<string | number | null>;
  selectedMunicipalityCodeRef: MutableRefObject<string | null>;
  selectedMunicipalityIdRef: MutableRefObject<string | number | null>;
  selectedMunicipalityBoundsRef: MutableRefObject<LngLatBoundsLike | null>;
  pendingSelectedMunicipalitySyncRef: MutableRefObject<boolean>;
  selectedMunicipalityRequestIdRef: MutableRefObject<number>;
  selectedMunicipalityFocusTimeoutRef: MutableRefObject<ReturnType<
    typeof setTimeout
  > | null>;
  onSelectedMunicipalityCodeChangeRef: MutableRefObject<
    ((municipalityCode: string | null) => void) | undefined
  >;
  showStatesBorderRef: MutableRefObject<boolean>;
  hasCdiDataRef: MutableRefObject<boolean>;
  cdiGeoJsonRef: MutableRefObject<ReturnType<typeof buildCdiGeoJson>>;
  currentBoundsRef: MutableRefObject<LngLatBoundsLike | null>;
  tileLayerUrlRef: MutableRefObject<string | null | undefined>;
  layerOpacityRef: MutableRefObject<number>;
  pendingStyleSyncRef: MutableRefObject<boolean>;
  pendingSelectedSyncRef: MutableRefObject<boolean>;
  fitMapToBounds: (
    map: maplibregl.Map,
    bounds: LngLatBoundsLike,
    options?: {
      animate?: boolean;
      duration?: number;
      easing?: (progress: number) => number;
      maxZoom?: number;
    },
  ) => void;
  fitSelectedMunicipalityToBounds: (
    map: maplibregl.Map,
    bounds: LngLatBoundsLike,
    options?: {
      animate?: boolean;
      duration?: number;
      easing?: (progress: number) => number;
    },
  ) => void;
}

export const useMapSelectionRuntime = ({
  debugEnabled,
  mapDebugIdRef,
  mapRef,
  mapModeRef,
  selectedStateRef,
  selectedStateIdRef,
  selectedMunicipalityCodeRef,
  selectedMunicipalityIdRef,
  selectedMunicipalityBoundsRef,
  pendingSelectedMunicipalitySyncRef,
  selectedMunicipalityRequestIdRef,
  selectedMunicipalityFocusTimeoutRef,
  onSelectedMunicipalityCodeChangeRef,
  showStatesBorderRef,
  hasCdiDataRef,
  cdiGeoJsonRef,
  currentBoundsRef,
  tileLayerUrlRef,
  layerOpacityRef,
  pendingStyleSyncRef,
  pendingSelectedSyncRef,
  fitMapToBounds,
  fitSelectedMunicipalityToBounds,
}: UseMapSelectionRuntimeArgs) => {
  const { applySelectedFeatureState, log, scheduleSelectedStateSync, warn } =
    useStateFeatureSelection({
      debugEnabled,
      mapDebugIdRef,
      mapRef,
      pendingSelectedSyncRef,
      selectedStateIdRef,
      selectedStateRef,
    });

  const {
    clearSelectedMunicipalityFocusTimeout,
    clearSelectedMunicipalitySelection,
    scheduleSelectedMunicipalitySync,
  } = useMunicipalitySelection({
    currentBoundsRef,
    fitMapToBounds,
    fitSelectedMunicipalityToBounds,
    log,
    mapRef,
    onSelectedMunicipalityCodeChangeRef,
    pendingSelectedMunicipalitySyncRef,
    selectedMunicipalityBoundsRef,
    selectedMunicipalityCodeRef,
    selectedMunicipalityFocusTimeoutRef,
    selectedMunicipalityIdRef,
    selectedMunicipalityRequestIdRef,
    warn,
  });

  const syncMapLayers = useMapLayerSync({
    applySelectedFeatureState,
    cdiGeoJsonRef,
    hasCdiDataRef,
    layerOpacityRef,
    log,
    mapModeRef,
    mapRef,
    pendingStyleSyncRef,
    scheduleSelectedMunicipalitySync,
    scheduleSelectedStateSync,
    selectedMunicipalityCodeRef,
    selectedStateRef,
    showStatesBorderRef,
    tileLayerUrlRef,
    warn,
  });

  return {
    applySelectedFeatureState,
    clearSelectedMunicipalityFocusTimeout,
    clearSelectedMunicipalitySelection,
    log,
    scheduleSelectedMunicipalitySync,
    scheduleSelectedStateSync,
    syncMapLayers,
    warn,
  };
};
