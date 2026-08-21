import type { CDIVectorData } from "@/lib/geo";
import type { FeatureCollection, Geometry } from "geojson";
import maplibregl, { LngLatBoundsLike } from "maplibre-gl";
import { useEffect, useRef, type MutableRefObject } from "react";
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
  spatialBoundaryGeoJson?: FeatureCollection<Geometry, { name: string }> | null;
  spatialFocusBounds?: LngLatBoundsLike | null;
  allowedStateUfs?: Set<string> | null;
  tileLayerUrl?: string | null;
  tileLayerRequestKey?: string | null;
  layerOpacity: number;
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
  spatialBoundaryGeoJsonRef: MutableRefObject<FeatureCollection<Geometry, { name: string }> | null>;
  allowedStateUfsRef: MutableRefObject<Set<string> | null>;
  spatialValue?: string;
  spatialValueRef?: MutableRefObject<string>;
  onStateSelectRef: MutableRefObject<((uf: string) => void) | undefined>;
  onSelectedMunicipalityCodeChangeRef: MutableRefObject<
    ((municipalityCode: string | null) => void) | undefined
  >;
  onTileLayerReadyRef: MutableRefObject<
    ((requestKey: string) => void) | undefined
  >;
  tileLayerUrlRef: MutableRefObject<string | null | undefined>;
  layerOpacityRef: MutableRefObject<number>;
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
  fitMapToBounds: (
    map: maplibregl.Map,
    bounds: LngLatBoundsLike,
    options?: {
      animate?: boolean;
      basePadding?: number;
      duration?: number;
      easing?: (progress: number) => number;
      maxZoom?: number;
    },
  ) => void;
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
}

interface SpatialFocusEffectArgs {
  fitMapToBounds: UseMapControllerEffectsArgs["fitMapToBounds"];
  mapInstanceVersion: number;
  mapRef: MutableRefObject<maplibregl.Map | null>;
  selectedMunicipalityCode?: string | null;
  spatialFocusBounds?: LngLatBoundsLike | null;
}

/**
 * Enquadra a área de interesse quando a seleção muda.
 *
 * Antes só o clique num estado e a seleção de município moviam a câmera; a
 * troca de área de interesse redesenhava o contorno e deixava o usuário
 * olhando para outra parte do mapa.
 */
const useSpatialFocusEffect = ({
  fitMapToBounds,
  mapInstanceVersion,
  mapRef,
  selectedMunicipalityCode,
  spatialFocusBounds,
}: SpatialFocusEffectArgs) => {
  const lastFocusKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !spatialFocusBounds) return;

    const focusKey = JSON.stringify(spatialFocusBounds);
    if (lastFocusKeyRef.current === focusKey) return;

    const isInitialFocus = lastFocusKeyRef.current === null;
    lastFocusKeyRef.current = focusKey;

    // Na montagem o enquadramento vem de `initialView`; mover a câmera aqui
    // brigaria com ele e animaria o mapa sem o usuário ter pedido nada.
    if (isInitialFocus) return;

    // O foco no município é mais específico e tem a própria animação.
    if (selectedMunicipalityCode) return;

    fitMapToBounds(map, spatialFocusBounds, {
      animate: true,
      duration: MAP_FOCUS_ANIMATION_DURATION,
      easing: smoothCameraEasing,
      maxZoom: MAP_STATE_FOCUS_MAX_ZOOM,
    });
  }, [
    fitMapToBounds,
    mapInstanceVersion,
    mapRef,
    selectedMunicipalityCode,
    spatialFocusBounds,
  ]);
};

export const useMapControllerEffects = ({
  mapMode,
  estadoSelecionado,
  selectedMunicipalityCode,
  spatialBoundaryGeoJson,
  spatialFocusBounds,
  allowedStateUfs,
  spatialValue,
  tileLayerUrl,
  tileLayerRequestKey,
  layerOpacity,
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
  spatialBoundaryGeoJsonRef,
  allowedStateUfsRef,
  spatialValueRef,
  onStateSelectRef,
  onSelectedMunicipalityCodeChangeRef,
  onTileLayerReadyRef,
  tileLayerUrlRef,
  layerOpacityRef,
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
  fitMapToBounds,
  log,
  warn,
}: UseMapControllerEffectsArgs) => {
  useSpatialFocusEffect({
    fitMapToBounds,
    mapInstanceVersion,
    mapRef,
    selectedMunicipalityCode,
    spatialFocusBounds,
  });

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
    spatialBoundaryGeoJsonRef.current = spatialBoundaryGeoJson ?? null;
    allowedStateUfsRef.current = allowedStateUfs ?? null;
    if (spatialValueRef && spatialValue) {
      spatialValueRef.current = spatialValue;
    }
    onStateSelectRef.current = onStateSelect;
    onSelectedMunicipalityCodeChangeRef.current =
      onSelectedMunicipalityCodeChange;
    onTileLayerReadyRef.current = onTileLayerReady;
    tileLayerUrlRef.current = tileLayerUrl;
    layerOpacityRef.current = layerOpacity;
    tileLayerRequestKeyRef.current = tileLayerRequestKey;
    showStatesBorderRef.current = showStatesBorder;
    hasCdiDataRef.current = Boolean(dadosCDI);
    cdiGeoJsonRef.current = cdiGeoJson;
    currentBoundsRef.current = currentBounds;
  }, [
    mapMode,
    estadoSelecionado,
    spatialBoundaryGeoJson,
    allowedStateUfs,
    spatialValue,
    onStateSelect,
    onSelectedMunicipalityCodeChange,
    onTileLayerReady,
    tileLayerUrl,
    tileLayerRequestKey,
    layerOpacity,
    showStatesBorder,
    selectedMunicipalityCode,
    dadosCDI,
    cdiGeoJson,
    currentBounds,
    mapModeRef,
    selectedStateRef,
    selectedMunicipalityCodeRef,
    selectedMunicipalityBoundsRef,
    spatialBoundaryGeoJsonRef,
    allowedStateUfsRef,
    spatialValueRef,
    onStateSelectRef,
    onSelectedMunicipalityCodeChangeRef,
    onTileLayerReadyRef,
    tileLayerUrlRef,
    layerOpacityRef,
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
