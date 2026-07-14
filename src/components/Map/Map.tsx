"use client";

import maplibregl, { MapSourceDataEvent, MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { CDIVectorData } from "@/lib/geo";
import {
  GEE_LAYER_ID,
  GEE_SOURCE_ID,
  type MapMode,
  STATES_FILL_LAYER_ID,
  STATES_SOURCE_ID,
  STATES_SOURCE_LAYER,
} from "./mapDefinitions";
import { useMapController } from "./useMapController";
import { useMapMarkers } from "./useMapMarkers";
import {
  BRAZIL_TERRITORY_CODE,
  resolveNextSelectedState,
} from "./stateSelection";
import { getSelectionAwareScrollZoomOptions } from "./selectionAwareZoom";
import { isTileLayerReadyEvent } from "./tileLayerLoading";
import {
  buildMunicipalityLabel,
  MUNICIPALITY_HOVER_LAYER_ID,
} from "./municipalityLayers";
export interface MapProps {
  mapMode?: MapMode;
  minZoom?: number;
  center: [number, number];
  zoom?: number;
  markers?: Array<{ position: [number, number]; label: string }>;
  className?: string;
  showStatesBorder?: boolean;
  dadosCDI?: CDIVectorData;
  estadoSelecionado: string;
  selectedMunicipalityCode?: string | null;
  tileLayerUrl?: string | null;
  tileLayerRequestKey?: string | null;
  onStateSelect?: (uf: string) => void;
  onSelectedMunicipalityCodeChange?: (municipalityCode: string | null) => void;
  onTileLayerReady?: (requestKey: string) => void;
  layerOpacity?: number;
}

const Map = ({
  mapMode = "platform",
  center = [51.505, -0.09],
  zoom = 13,
  minZoom = 3,
  markers = [],
  className = "h-full w-full",
  dadosCDI,
  showStatesBorder = true,
  estadoSelecionado,
  selectedMunicipalityCode,
  tileLayerUrl,
  tileLayerRequestKey,
  onStateSelect,
  onSelectedMunicipalityCodeChange,
  onTileLayerReady,
  layerOpacity = 0.85
}: MapProps) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const {
    BASE_STYLE,
    applySelectedFeatureState,
    clearSelectedMunicipalitySelection,
    currentBoundsRef,
    fitMapToBounds,
    hoveredStateIdRef,
    initialViewRef,
    log,
    mapModeRef,
    mapRef,
    mapInstanceVersion,
    onStateSelectRef,
    onTileLayerReadyRef,
    pendingTileLayerReadyKeyRef,
    popupRef,
    scheduleSelectedStateSync,
    selectedStateIdRef,
    selectedStateRef,
    setMapInstance,
    syncMapLayers,
    syncMapPadding,
    tileLayerRequestKeyRef,
    tileLayerUrlRef,
    warn,
  } = useMapController({
    center,
    dadosCDI,
    estadoSelecionado,
    mapMode,
    minZoom,
    onSelectedMunicipalityCodeChange,
    onStateSelect,
    onTileLayerReady,
    selectedMunicipalityCode,
    showStatesBorder,
    tileLayerRequestKey,
    tileLayerUrl,
    layerOpacity,
    zoom,
  });
  const { clearMarkers } = useMapMarkers(mapRef, markers, mapInstanceVersion);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const popup = popupRef.current;
    const initialView = initialViewRef.current;
    const initialCenter: [number, number] = [
      initialView.center[1],
      initialView.center[0],
    ];
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: BASE_STYLE,
      zoom: initialView.zoom,
      minZoom: initialView.minZoom,
      scrollZoom: getSelectionAwareScrollZoomOptions(selectedStateRef.current),
      attributionControl: false,
      maxPitch: 0,
    });

    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
      }),
      "top-right",
    );

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.jumpTo({ center: initialCenter, zoom: initialView.zoom });

    map.on("sourcedata", (event: MapSourceDataEvent) => {
      if (event.sourceId !== GEE_SOURCE_ID) return;

      const pendingRequestKey = pendingTileLayerReadyKeyRef.current;
      const currentRequestKey = tileLayerRequestKeyRef.current;

      if (!pendingRequestKey || !currentRequestKey) return;
      if (pendingRequestKey !== currentRequestKey) return;
      if (!tileLayerUrlRef.current) return;

      if (!isTileLayerReadyEvent(event, GEE_SOURCE_ID)) return;

      pendingTileLayerReadyKeyRef.current = null;
      log("gee layer ready", {
        requestKey: pendingRequestKey,
        sourceDataType: event.sourceDataType,
        hasTile: Boolean(event.tile),
        isSourceLoaded: event.isSourceLoaded,
      });
      onTileLayerReadyRef.current?.(pendingRequestKey);
    });

    map.on("load", () => {
      log("map load");
      syncMapLayers();
      syncMapPadding(map);

      const boundsToFit = currentBoundsRef.current;
      if (boundsToFit) {
        fitMapToBounds(map, boundsToFit, {
          animate: false,
        });
      }

      // Apply initial selected state via feature-state (works with vector tiles).
      if (
        mapModeRef.current === "platform" &&
        selectedStateRef.current &&
        selectedStateRef.current !== BRAZIL_TERRITORY_CODE
      ) {
        selectedStateIdRef.current = selectedStateRef.current;
        map.setFeatureState(
          {
            source: STATES_SOURCE_ID,
            sourceLayer: STATES_SOURCE_LAYER,
            id: selectedStateRef.current,
          },
          { selected: true },
        );
      }

      map.on("mousemove", STATES_FILL_LAYER_ID, (event) => {
        const hoveredFeature = event.features?.[0] as
          | MapGeoJSONFeature
          | undefined;
        const uf =
          (hoveredFeature?.properties?.SIGLA_UF as string | undefined) ??
          (hoveredFeature?.properties?.uf as string | undefined) ??
          (hoveredFeature?.properties?.sigla as string | undefined);

        const name =
          (hoveredFeature?.properties?.NM_UF as string | undefined) ??
          (hoveredFeature?.properties?.nome as string | undefined);

        const hoveredStateId = (hoveredFeature?.id ?? uf) as
          | string
          | number
          | null
          | undefined;

        if (
          hoveredStateIdRef.current &&
          hoveredStateIdRef.current !== hoveredStateId
        ) {
          map.setFeatureState(
            {
              source: STATES_SOURCE_ID,
              sourceLayer: STATES_SOURCE_LAYER,
              id: hoveredStateIdRef.current,
            },
            { hover: false },
          );
        }

        if (hoveredStateId !== undefined && hoveredStateId !== null) {
          hoveredStateIdRef.current = hoveredStateId;
          map.setFeatureState(
            {
              source: STATES_SOURCE_ID,
              sourceLayer: STATES_SOURCE_LAYER,
              id: hoveredStateId,
            },
            { hover: true },
          );
        }

        map.getCanvas().style.cursor = "pointer";

        if (uf || name) {
          popup
            .setLngLat(event.lngLat)
            .setText(name && uf ? `${name} (${uf})` : (name ?? uf ?? ""))
            .addTo(map);
        }
      });

      map.on("mouseleave", STATES_FILL_LAYER_ID, () => {
        if (hoveredStateIdRef.current) {
          map.setFeatureState(
            {
              source: STATES_SOURCE_ID,
              sourceLayer: STATES_SOURCE_LAYER,
              id: hoveredStateIdRef.current,
            },
            { hover: false },
          );
        }

        hoveredStateIdRef.current = null;
        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      map.on("click", STATES_FILL_LAYER_ID, (event) => {
        const clickedFeature = event.features?.[0] as
          | MapGeoJSONFeature
          | undefined;

        const uf =
          (clickedFeature?.properties?.SIGLA_UF as string | undefined) ??
          (clickedFeature?.properties?.uf as string | undefined) ??
          (clickedFeature?.properties?.sigla as string | undefined) ??
          (typeof clickedFeature?.id === "string"
            ? clickedFeature.id
            : undefined);

        if (!uf) return;

        const nextSelectedState = resolveNextSelectedState(
          selectedStateRef.current,
          uf,
        );

        log("state click", {
          uf,
          nextSelectedState,
          featureId: clickedFeature?.id,
          propertiesUF: clickedFeature?.properties?.SIGLA_UF,
          selectedStateRef: selectedStateRef.current,
          selectedStateIdRef: selectedStateIdRef.current,
          styleLoaded: map.isStyleLoaded(),
        });

        // Optimistically update the map selection immediately, so the outline
        // doesn't lag when `isStyleLoaded()` temporarily flips to false during
        // source/tile loading.
        try {
          if (map.getSource(STATES_SOURCE_ID)) {
            applySelectedFeatureState(map, nextSelectedState);
          } else {
            scheduleSelectedStateSync("click: states source missing");
          }
        } catch (err) {
          warn("click optimistic apply failed", {
            uf,
            nextSelectedState,
            err,
          });
          scheduleSelectedStateSync("click: setFeatureState threw");
        }

        onStateSelectRef.current?.(nextSelectedState);
      });

      if (mapModeRef.current === "platform") {
        map.on("click", () => {
          clearSelectedMunicipalitySelection(map);
        });

        map.on("mousemove", MUNICIPALITY_HOVER_LAYER_ID, (event) => {
          const municipalityFeature = event.features?.[0] as
            | MapGeoJSONFeature
            | undefined;
          const municipalityLabel = buildMunicipalityLabel(municipalityFeature);

          map.getCanvas().style.cursor = "pointer";

          if (municipalityLabel) {
            popup.setLngLat(event.lngLat).setText(municipalityLabel).addTo(map);
          }
        });

        map.on("mouseleave", MUNICIPALITY_HOVER_LAYER_ID, () => {
          map.getCanvas().style.cursor = "";
          popup.remove();
        });
      }
    });

    setMapInstance(map);

    return () => {
      popup.remove();
      clearMarkers();
      map.remove();
      setMapInstance(null);
    };
  }, [
    BASE_STYLE,
    syncMapLayers,
    syncMapPadding,
    applySelectedFeatureState,
    clearSelectedMunicipalitySelection,
    scheduleSelectedStateSync,
    currentBoundsRef,
    fitMapToBounds,
    hoveredStateIdRef,
    initialViewRef,
    log,
    mapContainerRef,
    mapModeRef,
    mapRef,
    onStateSelectRef,
    onTileLayerReadyRef,
    pendingTileLayerReadyKeyRef,
    popupRef,
    selectedStateIdRef,
    selectedStateRef,
    tileLayerRequestKeyRef,
    tileLayerUrlRef,
    warn,
    clearMarkers,
    setMapInstance,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    try {
      if (map.getLayer(GEE_LAYER_ID)) {
        map.setPaintProperty(GEE_LAYER_ID, "raster-opacity", layerOpacity);
      }
    } catch {
    }
  }, [layerOpacity, mapRef, mapInstanceVersion]);

  return (
    <div className="w-full h-full">
      <div className={className} ref={mapContainerRef} />
    </div>
  );
};

export default Map;
