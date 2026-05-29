import type { CDIVectorData } from "@/lib/geo";
import maplibregl, { LngLatBoundsLike } from "maplibre-gl";
import { useEffect, type MutableRefObject } from "react";
import {
  MAP_FOCUS_ANIMATION_DURATION,
  MAP_OVERLAY_ADJUST_DURATION,
  MAP_STATE_FOCUS_MAX_ZOOM,
  buildCdiGeoJson,
  smoothCameraEasing,
} from "./mapBounds";
import { STATES_SOURCE_ID } from "./mapDefinitions";
import { syncSelectionAwareScrollZoom } from "./selectionAwareZoom";

interface UseMapControllerEffectsArgs {
  mapMode: "demo" | "platform";
  estadoSelecionado: string;
  selectedMunicipalityCode?: string | null;
  tileLayerUrl?: string | null;
  tileLayerRequestKey?: string | null;
  showStatesBorder: boolean;
  dadosCDI?: CDIVectorData;
  onStateSelect?: (uf: string) => void;
  onSelectedMunicipalityCodeChange?: (municipalityCode: string | null) => void;
  onTileLayerReady?: (requestKey: string) => void;
  currentBounds: LngLatBoundsLike;
  cdiGeoJson: ReturnType<typeof buildCdiGeoJson>;
  leftOverlayWidth: number;
  mapInstanceVersion: number;
  mapRef: MutableRefObject<maplibregl.Map | null>;
  mapModeRef: MutableRefObject<"demo" | "platform">;
  selectedStateRef: MutableRefObject<string>;
  selectedStateIdRef: MutableRefObject<string | number | null>;
  selectedMunicipalityCodeRef: MutableRefObject<string | null>;
  selectedMunicipalityBoundsRef: MutableRefObject<LngLatBoundsLike | null>;
  onStateSelectRef: MutableRefObject<((uf: string) => void) | undefined>;
  onSelectedMunicipalityCodeChangeRef: MutableRefObject<
    ((municipalityCode: string | null) => void) | undefined
  >;
  onTileLayerReadyRef: MutableRefObject<
    ((requestKey: string) => void) | undefined
  >;
  tileLayerUrlRef: MutableRefObject<string | null | undefined>;
  tileLayerRequestKeyRef: MutableRefObject<string | null | undefined>;
  pendingTileLayerReadyKeyRef: MutableRefObject<string | null>;
  showStatesBorderRef: MutableRefObject<boolean>;
  hasCdiDataRef: MutableRefObject<boolean>;
  cdiGeoJsonRef: MutableRefObject<ReturnType<typeof buildCdiGeoJson>>;
  currentBoundsRef: MutableRefObject<LngLatBoundsLike | null>;
  leftOverlayWidthRef: MutableRefObject<number>;
  clearSelectedMunicipalityFocusTimeout: () => void;
  applySelectedFeatureState: (map: maplibregl.Map, next: string) => void;
  scheduleSelectedStateSync: (reason: string) => void;
  scheduleSelectedMunicipalitySync: (reason: string) => void;
  syncMapLayers: () => void;
  syncMapPadding: (map: maplibregl.Map) => void;
  fitSelectedStateToBounds: (
    map: maplibregl.Map,
    bounds: LngLatBoundsLike,
    options: {
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
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

export const useMapControllerEffects = ({
  mapMode,
  estadoSelecionado,
  selectedMunicipalityCode,
  tileLayerUrl,
  tileLayerRequestKey,
  showStatesBorder,
  dadosCDI,
  onStateSelect,
  onSelectedMunicipalityCodeChange,
  onTileLayerReady,
  currentBounds,
  cdiGeoJson,
  leftOverlayWidth,
  mapInstanceVersion,
  mapRef,
  mapModeRef,
  selectedStateRef,
  selectedStateIdRef,
  selectedMunicipalityCodeRef,
  selectedMunicipalityBoundsRef,
  onStateSelectRef,
  onSelectedMunicipalityCodeChangeRef,
  onTileLayerReadyRef,
  tileLayerUrlRef,
  tileLayerRequestKeyRef,
  pendingTileLayerReadyKeyRef,
  showStatesBorderRef,
  hasCdiDataRef,
  cdiGeoJsonRef,
  currentBoundsRef,
  leftOverlayWidthRef,
  clearSelectedMunicipalityFocusTimeout,
  applySelectedFeatureState,
  scheduleSelectedStateSync,
  scheduleSelectedMunicipalitySync,
  syncMapLayers,
  syncMapPadding,
  fitSelectedStateToBounds,
  fitSelectedMunicipalityToBounds,
  log,
  warn,
}: UseMapControllerEffectsArgs) => {
  useEffect(
    () => clearSelectedMunicipalityFocusTimeout,
    [clearSelectedMunicipalityFocusTimeout],
  );

  useEffect(() => {
    mapModeRef.current = mapMode;
    selectedStateRef.current = estadoSelecionado;
    selectedMunicipalityCodeRef.current = selectedMunicipalityCode ?? null;
    if (!selectedMunicipalityCode) {
      selectedMunicipalityBoundsRef.current = null;
    }
    onStateSelectRef.current = onStateSelect;
    onSelectedMunicipalityCodeChangeRef.current =
      onSelectedMunicipalityCodeChange;
    onTileLayerReadyRef.current = onTileLayerReady;
    tileLayerUrlRef.current = tileLayerUrl;
    tileLayerRequestKeyRef.current = tileLayerRequestKey;
    showStatesBorderRef.current = showStatesBorder;
    hasCdiDataRef.current = Boolean(dadosCDI);
    cdiGeoJsonRef.current = cdiGeoJson;
    currentBoundsRef.current = currentBounds;
  }, [
    mapMode,
    estadoSelecionado,
    onStateSelect,
    onSelectedMunicipalityCodeChange,
    onTileLayerReady,
    tileLayerUrl,
    tileLayerRequestKey,
    showStatesBorder,
    selectedMunicipalityCode,
    dadosCDI,
    cdiGeoJson,
    currentBounds,
    mapModeRef,
    selectedStateRef,
    selectedMunicipalityCodeRef,
    selectedMunicipalityBoundsRef,
    onStateSelectRef,
    onSelectedMunicipalityCodeChangeRef,
    onTileLayerReadyRef,
    tileLayerUrlRef,
    tileLayerRequestKeyRef,
    showStatesBorderRef,
    hasCdiDataRef,
    cdiGeoJsonRef,
    currentBoundsRef,
  ]);

  useEffect(() => {
    if (!tileLayerUrl || !tileLayerRequestKey) {
      pendingTileLayerReadyKeyRef.current = null;
      return;
    }

    pendingTileLayerReadyKeyRef.current = tileLayerRequestKey;
  }, [pendingTileLayerReadyKeyRef, tileLayerUrl, tileLayerRequestKey]);

  useEffect(() => {
    leftOverlayWidthRef.current = leftOverlayWidth;
  }, [leftOverlayWidth, leftOverlayWidthRef]);

  useEffect(() => {
    syncMapLayers();
  }, [
    syncMapLayers,
    cdiGeoJson,
    dadosCDI,
    mapInstanceVersion,
    mapMode,
    showStatesBorder,
    tileLayerUrl,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || mapMode !== "platform") return;

    const next = estadoSelecionado;

    log("estadoSelecionado effect", {
      next,
      styleLoaded: map.isStyleLoaded(),
      hasStatesSource: Boolean(map.getSource(STATES_SOURCE_ID)),
      selectedStateIdRef: selectedStateIdRef.current,
    });

    try {
      if (!map.getSource(STATES_SOURCE_ID)) {
        scheduleSelectedStateSync("estadoSelecionado: states source missing");
        return;
      }

      applySelectedFeatureState(map, next);
    } catch (err) {
      warn("estadoSelecionado effect apply failed", { err });
      scheduleSelectedStateSync("setFeatureState failed");
    }
  }, [
    estadoSelecionado,
    mapMode,
    mapInstanceVersion,
    applySelectedFeatureState,
    scheduleSelectedStateSync,
    log,
    mapRef,
    selectedStateIdRef,
    warn,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || mapMode !== "platform") {
      return;
    }

    selectedMunicipalityBoundsRef.current = null;

    scheduleSelectedMunicipalitySync("selectedMunicipalityCode effect");
  }, [
    mapInstanceVersion,
    mapMode,
    mapRef,
    selectedMunicipalityBoundsRef,
    selectedMunicipalityCode,
    scheduleSelectedMunicipalitySync,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    syncSelectionAwareScrollZoom(map.scrollZoom, estadoSelecionado);
  }, [estadoSelecionado, mapInstanceVersion, mapRef]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    syncMapPadding(map);
  }, [leftOverlayWidth, mapInstanceVersion, mapRef, syncMapPadding]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    if (
      selectedMunicipalityCodeRef.current &&
      !selectedMunicipalityBoundsRef.current
    ) {
      return;
    }

    if (
      selectedMunicipalityCodeRef.current &&
      selectedMunicipalityBoundsRef.current
    ) {
      fitSelectedMunicipalityToBounds(
        map,
        selectedMunicipalityBoundsRef.current,
        {
          animate: true,
          duration: MAP_FOCUS_ANIMATION_DURATION,
          easing: smoothCameraEasing,
        },
      );
      return;
    }

    fitSelectedStateToBounds(map, currentBounds, {
      animate: true,
      duration: MAP_FOCUS_ANIMATION_DURATION,
      easing: smoothCameraEasing,
      maxZoom: MAP_STATE_FOCUS_MAX_ZOOM,
    });
  }, [
    currentBounds,
    fitSelectedMunicipalityToBounds,
    fitSelectedStateToBounds,
    mapInstanceVersion,
    mapRef,
    selectedMunicipalityBoundsRef,
    selectedMunicipalityCodeRef,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const boundsToFit = currentBoundsRef.current;

    if (!map || !boundsToFit) {
      return;
    }

    if (
      selectedMunicipalityCodeRef.current &&
      !selectedMunicipalityBoundsRef.current
    ) {
      return;
    }

    if (
      selectedMunicipalityCodeRef.current &&
      selectedMunicipalityBoundsRef.current
    ) {
      fitSelectedMunicipalityToBounds(
        map,
        selectedMunicipalityBoundsRef.current,
        {
          animate: false,
          duration: MAP_OVERLAY_ADJUST_DURATION,
        },
      );
      return;
    }

    fitSelectedStateToBounds(map, boundsToFit, {
      animate: false,
      duration: MAP_OVERLAY_ADJUST_DURATION,
      maxZoom: MAP_STATE_FOCUS_MAX_ZOOM,
    });
  }, [
    currentBoundsRef,
    fitSelectedMunicipalityToBounds,
    fitSelectedStateToBounds,
    leftOverlayWidth,
    mapInstanceVersion,
    mapRef,
    selectedMunicipalityBoundsRef,
    selectedMunicipalityCodeRef,
  ]);
};
