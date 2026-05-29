import type { CDIVectorData } from "@/lib/geo";
import maplibregl, { LngLatBoundsLike } from "maplibre-gl";
import { useCallback, useId, useMemo, useRef, useState } from "react";
import { BASE_STYLE, type MapMode } from "./mapDefinitions";
import {
  DEFAULT_CENTER,
  MAP_MUNICIPALITY_FOCUS_MAX_ZOOM,
  type MapFitBoundsOptions,
  buildCdiGeoJson,
  enforceMinimumMapZoom,
  geoBrasilSource,
  isValidLatLngTuple,
  resolveCurrentBounds,
} from "./mapBounds";
import {
  buildOverlayAwareFitBoundsPadding,
  buildOverlayAwareMapPadding,
  MAP_FIT_BOUNDS_BASE_PADDING,
} from "./mapViewport";
import { BRAZIL_TERRITORY_CODE } from "./stateSelection";
import { MUNICIPALITY_MIN_ZOOM } from "./municipalityLayers";
import { useMapControllerEffects } from "./useMapControllerEffects";
import { useMapSelectionRuntime } from "./useMapSelectionRuntime";
import { usePlatformSidebarOverlayWidth } from "./usePlatformSidebarOverlayWidth";

interface UseMapControllerArgs {
  mapMode: MapMode;
  center: [number, number];
  zoom: number;
  minZoom: number;
  dadosCDI?: CDIVectorData;
  showStatesBorder: boolean;
  estadoSelecionado: string;
  selectedMunicipalityCode?: string | null;
  tileLayerUrl?: string | null;
  tileLayerRequestKey?: string | null;
  onStateSelect?: (uf: string) => void;
  onSelectedMunicipalityCodeChange?: (municipalityCode: string | null) => void;
  onTileLayerReady?: (requestKey: string) => void;
}

export const useMapController = ({
  mapMode,
  center,
  zoom,
  minZoom,
  dadosCDI,
  showStatesBorder,
  estadoSelecionado,
  selectedMunicipalityCode,
  tileLayerUrl,
  tileLayerRequestKey,
  onStateSelect,
  onSelectedMunicipalityCodeChange,
  onTileLayerReady,
}: UseMapControllerArgs) => {
  const debugEnabled = process.env.NODE_ENV !== "production";
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapInstanceVersion, setMapInstanceVersion] = useState(0);
  const popupRef = useRef(
    new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    }),
  );
  const mapDebugId = useId().replace(/:/g, "").slice(-6);
  const mapDebugIdRef = useRef<string>(mapDebugId);
  const hoveredStateIdRef = useRef<string | number | null>(null);
  const selectedStateIdRef = useRef<string | number | null>(null);
  const selectedMunicipalityCodeRef = useRef<string | null>(
    selectedMunicipalityCode ?? null,
  );
  const selectedMunicipalityIdRef = useRef<string | number | null>(null);
  const selectedStateRef = useRef<string>(estadoSelecionado);
  const onStateSelectRef = useRef(onStateSelect);
  const onSelectedMunicipalityCodeChangeRef = useRef(
    onSelectedMunicipalityCodeChange,
  );
  const onTileLayerReadyRef = useRef(onTileLayerReady);
  const tileLayerUrlRef = useRef<string | null | undefined>(tileLayerUrl);
  const tileLayerRequestKeyRef = useRef<string | null | undefined>(
    tileLayerRequestKey,
  );
  const pendingTileLayerReadyKeyRef = useRef<string | null>(
    tileLayerUrl && tileLayerRequestKey ? tileLayerRequestKey : null,
  );
  const mapModeRef = useRef<MapMode>(mapMode);
  const showStatesBorderRef = useRef<boolean>(showStatesBorder);
  const hasCdiDataRef = useRef<boolean>(Boolean(dadosCDI));
  const cdiGeoJsonRef = useRef(buildCdiGeoJson(dadosCDI));
  const currentBoundsRef = useRef<LngLatBoundsLike | null>(null);
  const selectedMunicipalityBoundsRef = useRef<LngLatBoundsLike | null>(null);
  const pendingSelectedMunicipalitySyncRef = useRef(false);
  const selectedMunicipalityRequestIdRef = useRef(0);
  const selectedMunicipalityFocusTimeoutRef = useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const pendingStyleSyncRef = useRef(false);
  const pendingSelectedSyncRef = useRef(false);
  const leftOverlayWidthRef = useRef(0);
  const leftOverlayWidth = usePlatformSidebarOverlayWidth();
  const normalizedCenter = isValidLatLngTuple(center) ? center : DEFAULT_CENTER;
  const initialViewRef = useRef({
    center: normalizedCenter,
    zoom,
    minZoom,
  });

  const currentBounds = useMemo(
    (): LngLatBoundsLike =>
      resolveCurrentBounds(geoBrasilSource, estadoSelecionado),
    [estadoSelecionado],
  );

  const cdiGeoJson = useMemo(() => buildCdiGeoJson(dadosCDI), [dadosCDI]);

  const setMapInstance = useCallback((map: maplibregl.Map | null) => {
    mapRef.current = map;
    setMapInstanceVersion((current) => current + 1);
  }, []);

  const fitMapToBounds = useCallback(
    (
      map: maplibregl.Map,
      bounds: LngLatBoundsLike,
      options: Omit<MapFitBoundsOptions, "padding"> = {},
    ) => {
      map.fitBounds(bounds, {
        ...options,
        padding: buildOverlayAwareFitBoundsPadding({
          basePadding: MAP_FIT_BOUNDS_BASE_PADDING,
          containerWidth: map.getContainer().clientWidth,
          leftOverlayWidth: leftOverlayWidthRef.current,
        }),
      });
    },
    [],
  );

  const fitSelectedStateToBounds = useCallback(
    (
      map: maplibregl.Map,
      bounds: LngLatBoundsLike,
      options: MapFitBoundsOptions,
    ) => {
      fitMapToBounds(map, bounds, options);
      if (selectedStateRef.current === BRAZIL_TERRITORY_CODE) return;

      const enforceMunicipalityZoom = () => {
        enforceMinimumMapZoom(map, MUNICIPALITY_MIN_ZOOM, options);
      };

      if (options.animate) {
        map.once("moveend", enforceMunicipalityZoom);
        return;
      }

      enforceMunicipalityZoom();
    },
    [fitMapToBounds],
  );

  const fitSelectedMunicipalityToBounds = useCallback(
    (
      map: maplibregl.Map,
      bounds: LngLatBoundsLike,
      options: Omit<MapFitBoundsOptions, "maxZoom"> = {},
    ) => {
      fitMapToBounds(map, bounds, {
        ...options,
        maxZoom: MAP_MUNICIPALITY_FOCUS_MAX_ZOOM,
      });
    },
    [fitMapToBounds],
  );

  const syncMapPadding = useCallback((map: maplibregl.Map) => {
    map.setPadding(
      buildOverlayAwareMapPadding({
        basePadding: MAP_FIT_BOUNDS_BASE_PADDING,
        containerWidth: map.getContainer().clientWidth,
        leftOverlayWidth: leftOverlayWidthRef.current,
      }),
    );
  }, []);

  const {
    applySelectedFeatureState,
    clearSelectedMunicipalityFocusTimeout,
    clearSelectedMunicipalitySelection,
    log,
    scheduleSelectedMunicipalitySync,
    scheduleSelectedStateSync,
    syncMapLayers,
    warn,
  } = useMapSelectionRuntime({
    cdiGeoJsonRef,
    currentBoundsRef,
    debugEnabled,
    fitMapToBounds,
    fitSelectedMunicipalityToBounds,
    hasCdiDataRef,
    mapDebugIdRef,
    mapModeRef,
    mapRef,
    onSelectedMunicipalityCodeChangeRef,
    pendingSelectedMunicipalitySyncRef,
    pendingSelectedSyncRef,
    pendingStyleSyncRef,
    selectedMunicipalityBoundsRef,
    selectedMunicipalityCodeRef,
    selectedMunicipalityFocusTimeoutRef,
    selectedMunicipalityIdRef,
    selectedMunicipalityRequestIdRef,
    selectedStateIdRef,
    selectedStateRef,
    showStatesBorderRef,
    tileLayerUrlRef,
  });

  useMapControllerEffects({
    applySelectedFeatureState,
    cdiGeoJson,
    cdiGeoJsonRef,
    clearSelectedMunicipalityFocusTimeout,
    currentBounds,
    currentBoundsRef,
    dadosCDI,
    estadoSelecionado,
    fitSelectedMunicipalityToBounds,
    fitSelectedStateToBounds,
    hasCdiDataRef,
    leftOverlayWidth,
    leftOverlayWidthRef,
    log,
    mapInstanceVersion,
    mapMode,
    mapModeRef,
    mapRef,
    onSelectedMunicipalityCodeChange,
    onSelectedMunicipalityCodeChangeRef,
    onStateSelect,
    onStateSelectRef,
    onTileLayerReady,
    onTileLayerReadyRef,
    pendingTileLayerReadyKeyRef,
    scheduleSelectedMunicipalitySync,
    scheduleSelectedStateSync,
    selectedMunicipalityBoundsRef,
    selectedMunicipalityCode,
    selectedMunicipalityCodeRef,
    selectedStateIdRef,
    selectedStateRef,
    showStatesBorder,
    showStatesBorderRef,
    syncMapLayers,
    syncMapPadding,
    tileLayerRequestKey,
    tileLayerRequestKeyRef,
    tileLayerUrl,
    tileLayerUrlRef,
    warn,
  });

  return {
    BASE_STYLE,
    applySelectedFeatureState,
    clearSelectedMunicipalitySelection,
    currentBoundsRef,
    fitMapToBounds,
    initialViewRef,
    log,
    mapModeRef,
    mapRef,
    mapInstanceVersion,
    onStateSelectRef,
    onTileLayerReadyRef,
    pendingTileLayerReadyKeyRef,
    popupRef,
    scheduleSelectedMunicipalitySync,
    scheduleSelectedStateSync,
    selectedMunicipalityCodeRef,
    selectedStateIdRef,
    selectedStateRef,
    setMapInstance,
    syncMapLayers,
    syncMapPadding,
    tileLayerRequestKeyRef,
    tileLayerUrlRef,
    hoveredStateIdRef,
    warn,
  };
};
