import type { CDIVectorData } from "@/lib/geo";
import * as maplibregl from "maplibre-gl";
import { LngLatBoundsLike } from "maplibre-gl";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
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
  PHONE_FIT_BOUNDS_PADDING,
} from "./mapViewport";
import { isPhoneViewport } from "@/components/PlatformMap/platformMapView";
import { BRAZIL_TERRITORY_CODE } from "./stateSelection";
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
  layerOpacity: number;
  onStateSelect?: (uf: string) => void;
  onSelectedMunicipalityCodeChange?: (municipalityCode: string | null) => void;
  onTileLayerReady?: (requestKey: string) => void;
  spatialBoundaryGeoJson?: FeatureCollection<Geometry, { name: string }> | null;
  spatialFocusBounds?: LngLatBoundsLike | null;
  allowedStateUfs?: Set<string> | null;
  spatialValue?: string;
  /** Altura que os controles cobrem na borda de baixo do mapa (só no celular). */
  bottomOverlayInset?: number;
}

/** O último enquadramento pedido, para refazê-lo quando a borda livre muda. */
interface LastFit {
  bounds: LngLatBoundsLike;
  options: Omit<MapFitBoundsOptions, "padding"> & { basePadding?: number };
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
  layerOpacity,
  onStateSelect,
  onSelectedMunicipalityCodeChange,
  onTileLayerReady,
  spatialBoundaryGeoJson = null,
  spatialFocusBounds = null,
  allowedStateUfs = null,
  spatialValue = "brasil",
  bottomOverlayInset = 0,
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
  const hoveredMunicipalityIdRef = useRef<string | number | null>(null);
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
  const layerOpacityRef = useRef(layerOpacity);
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
  const bottomOverlayInsetRef = useRef(bottomOverlayInset);
  const lastFitRef = useRef<LastFit | null>(null);
  const userMovedSinceFitRef = useRef(false);
  const spatialBoundaryGeoJsonRef = useRef<FeatureCollection<Geometry, { name: string }> | null>(spatialBoundaryGeoJson);
  const allowedStateUfsRef = useRef<Set<string> | null>(allowedStateUfs);
  const spatialValueRef = useRef<string>(spatialValue);
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
      options: Omit<MapFitBoundsOptions, "padding"> & { basePadding?: number } = {},
    ) => {
      const { basePadding = MAP_FIT_BOUNDS_BASE_PADDING, ...restOptions } = options;
      lastFitRef.current = { bounds, options };
      userMovedSinceFitRef.current = false;
      map.fitBounds(bounds, {
        ...restOptions,
        padding: buildOverlayAwareFitBoundsPadding({
          // A folga de 200px do computador, num celular de 390px, deixava o
          // Brasil (ou o estado) espremido numa faixa de 160px no meio.
          basePadding: isPhoneViewport()
            ? Math.min(basePadding, PHONE_FIT_BOUNDS_PADDING)
            : basePadding,
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
        // Enforce a zoom of 5 to maintain the same state zoom level as before,
        // even though municipalities are now visible at 4.5
        enforceMinimumMapZoom(map, 5, options);
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
      options: Omit<MapFitBoundsOptions, "maxZoom" | "padding"> & { basePadding?: number } = {},
    ) => {
      fitMapToBounds(map, bounds, {
        ...options,
        basePadding: options.basePadding ?? 50,
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
        containerHeight: map.getContainer().clientHeight,
        leftOverlayWidth: leftOverlayWidthRef.current,
        bottomOverlayHeight: bottomOverlayInsetRef.current,
      }),
    );
  }, []);

  // Quem arrasta, pinça ou usa o zoom escolheu outro enquadramento: a partir
  // daí a legenda abrir ou fechar não deve tirar o mapa de onde a pessoa o pôs.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const onMoveStart = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) userMovedSinceFitRef.current = true;
    };
    map.on("movestart", onMoveStart);
    return () => {
      map.off("movestart", onMoveStart);
    };
  }, [mapInstanceVersion]);

  // No celular a legenda e o botão "Mostrar opções" cobrem a borda de baixo.
  // A folga do mapa acompanha essa altura, e, enquanto a pessoa não mexeu no
  // mapa, o último enquadramento é refeito para caber acima deles.
  useEffect(() => {
    bottomOverlayInsetRef.current = bottomOverlayInset;
    const map = mapRef.current;
    if (!map) return;

    syncMapPadding(map);
    const lastFit = lastFitRef.current;
    if (lastFit && !userMovedSinceFitRef.current) {
      fitMapToBounds(map, lastFit.bounds, { ...lastFit.options, animate: false });
    }
  }, [bottomOverlayInset, fitMapToBounds, mapInstanceVersion, syncMapPadding]);

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
    spatialBoundaryGeoJsonRef,
    allowedStateUfsRef,
    spatialValueRef,
    tileLayerUrlRef,
    layerOpacityRef,
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
    spatialBoundaryGeoJson,
    spatialFocusBounds,
    allowedStateUfs,
    spatialValue,
    spatialValueRef,
    fitMapToBounds,
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
    spatialBoundaryGeoJsonRef,
    allowedStateUfsRef,
    showStatesBorder,
    showStatesBorderRef,
    syncMapLayers,
    syncMapPadding,
    tileLayerRequestKey,
    tileLayerRequestKeyRef,
    tileLayerUrl,
    tileLayerUrlRef,
    layerOpacity,
    layerOpacityRef,
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
    onSelectedMunicipalityCodeChangeRef,
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
    hoveredMunicipalityIdRef,
    spatialValueRef,
    warn,
  };
};
