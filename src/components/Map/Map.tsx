"use client";

import maplibregl, {
  LngLatBoundsLike,
  MapSourceDataEvent,
  MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import type { CDIVectorData } from "@/lib/geo";
import type { SpatialArea, SpatialSelection } from "@/utils/spatialScope";
import { getStateRegion } from "@/utils/interestAreaStates";
import { resolveBiomeAtPoint } from "./resolveBiomeAtPoint";
import {
  applyBiomeHoverPreview,
  applyRegionHoverPreview,
  clearBiomeHoverPreview,
  clearRegionHoverPreview,
  clearStateHoverPreview,
  type HoveredRegion,
} from "./spatialAreaHoverPreview";
import {
  GEE_LAYER_ID,
  GEE_SOURCE_ID,
  type MapMode,
  OSM_LAYER_ID,
  SATELLITE_LAYER_ID,
  STATES_FILL_LAYER_ID,
  STATES_SOURCE_ID,
  STATES_SOURCE_LAYER,
  ensureReferenceOverlayLayers,
  ensureSpatialBoundaryLayer,
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
  MUNICIPALITY_SOURCE_ID,
  MUNICIPALITY_SOURCE_LAYER,
} from "./municipalityLayers";
import { useSpatialAreaClickSelection } from "./useSpatialAreaClickSelection";
export type BasemapId = "osm" | "satellite";

const EMPTY_TILE_URL_MAP: globalThis.Map<string, string | undefined> =
  new globalThis.Map();

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
  basemap?: BasemapId;
  onStateSelect?: (uf: string) => void;
  onSelectedMunicipalityCodeChange?: (municipalityCode: string | null) => void;
  onTileLayerReady?: (requestKey: string) => void;
  layerOpacity?: number;
  allowedStateUfs?: Set<string> | null;
  spatialBoundaryGeoJson?: FeatureCollection<Geometry, { name: string }> | null;
  spatialArea?: SpatialArea;
  spatialValue?: string;
  onSpatialSelectionChange?: (selection: SpatialSelection) => void;
  /** Limites da área de interesse a enquadrar quando a seleção muda. */
  spatialFocusBounds?: LngLatBoundsLike | null;
  /** Tile URLs for active reference overlay layers (quilombolas, etc.). */
  referenceOverlayTileUrls?: Map<string, string | undefined>;
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
  basemap = "osm",
  onStateSelect,
  onSelectedMunicipalityCodeChange,
  onTileLayerReady,
  layerOpacity = 0.85,
  allowedStateUfs = null,
  spatialBoundaryGeoJson = null,
  spatialArea = "national",
  spatialValue = "brasil",
  onSpatialSelectionChange,
  spatialFocusBounds = null,
  referenceOverlayTileUrls,
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
    onSelectedMunicipalityCodeChangeRef,
    onStateSelectRef,
    onTileLayerReadyRef,
    pendingTileLayerReadyKeyRef,
    popupRef,
    scheduleSelectedStateSync,
    selectedStateIdRef,
    selectedMunicipalityCodeRef,
    selectedStateRef,
    setMapInstance,
    syncMapLayers,
    syncMapPadding,
    tileLayerRequestKeyRef,
    tileLayerUrlRef,
    hoveredMunicipalityIdRef,
    spatialValueRef,
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
    spatialBoundaryGeoJson,
    spatialFocusBounds,
    allowedStateUfs,
    spatialValue,
    tileLayerRequestKey,
    tileLayerUrl,
    layerOpacity,
    zoom,
  });
  const { clearMarkers } = useMapMarkers(mapRef, markers, mapInstanceVersion);
  const allowedStateUfsRef = useRef(allowedStateUfs);
  const spatialAreaRef = useRef<SpatialArea>(spatialArea);
  const onSpatialSelectionChangeRef = useRef(onSpatialSelectionChange);
  const hoveredBoundaryRef = useRef<string | null>(null);
  const hoveredRegionRef = useRef<HoveredRegion | null>(null);

  useEffect(() => {
    spatialAreaRef.current = spatialArea;
    onSpatialSelectionChangeRef.current = onSpatialSelectionChange;

    // O recorte mudou com o mouse parado: o destaque desenhado para o recorte
    // anterior não faz mais sentido. O próximo mousemove reaplica o correto.
    clearRegionHoverPreview(mapRef.current, hoveredRegionRef);
    clearBiomeHoverPreview(mapRef.current, hoveredBoundaryRef);
  }, [spatialArea, spatialValue, onSpatialSelectionChange, mapRef]);

  const { resolveSpatialClick } = useSpatialAreaClickSelection({
    mapRef,
    spatialAreaRef,
    spatialValueRef,
  });

  useEffect(() => {
    allowedStateUfsRef.current = allowedStateUfs;

    // Recorte mudou com o mouse parado: limpa o hover ativo se o estado
    // hoverado saiu da área. (O próximo mousemove reaplica o hover correto.)
    const map = mapRef.current;
    if (!map || !allowedStateUfs || !hoveredStateIdRef.current) return;
    if (typeof hoveredStateIdRef.current !== "string") return;
    if (allowedStateUfs.has(hoveredStateIdRef.current.toLowerCase())) return;

    map.setFeatureState(
      {
        source: STATES_SOURCE_ID,
        sourceLayer: STATES_SOURCE_LAYER,
        id: hoveredStateIdRef.current,
      },
      { hover: false },
    );
    hoveredStateIdRef.current = null;
    map.getCanvas().style.cursor = "";
  }, [allowedStateUfs, hoveredStateIdRef, mapRef, popupRef]);

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
          MapGeoJSONFeature | undefined;
        const uf =
          (hoveredFeature?.properties?.SIGLA_UF as string | undefined) ??
          (hoveredFeature?.properties?.uf as string | undefined) ??
          (hoveredFeature?.properties?.sigla as string | undefined);

        const name =
          (hoveredFeature?.properties?.NM_UF as string | undefined) ??
          (hoveredFeature?.properties?.nome as string | undefined);

        const hoveredStateId = (hoveredFeature?.id ?? uf) as
          string | number | null | undefined;

        // O recorte ativo decide o que o hover mostra: em região destacamos
        // os estados da região inteira, em bioma o polígono do bioma. Nos
        // outros recortes segue o hover de estado, logo abaixo.
        if (spatialAreaRef.current === "region") {
          clearStateHoverPreview(map, hoveredStateIdRef);
          const regionName = uf ? getStateRegion(uf) : null;

          if (regionName) {
            applyRegionHoverPreview(map, {
              regionName,
              lngLat: event.lngLat,
              popup,
              hoveredRegionRef,
            });
          } else {
            clearRegionHoverPreview(map, hoveredRegionRef);
            map.getCanvas().style.cursor = "";
            popup.remove();
          }

          return;
        }

        if (spatialAreaRef.current === "biome") {
          clearStateHoverPreview(map, hoveredStateIdRef);
          const biomeName = resolveBiomeAtPoint(map, event.point, uf);

          if (biomeName) {
            applyBiomeHoverPreview(map, {
              biomeName,
              lngLat: event.lngLat,
              popup,
              hoveredBoundaryRef,
            });
          } else {
            clearBiomeHoverPreview(map, hoveredBoundaryRef);
            map.getCanvas().style.cursor = "";
            popup.remove();
          }

          return;
        }

        const allowedUfs = allowedStateUfsRef.current;
        const isOutsideArea = Boolean(
          allowedUfs && uf && !allowedUfs.has(uf.toLowerCase()),
        );

        if (isOutsideArea) {
          if (hoveredStateIdRef.current) {
            map.setFeatureState(
              {
                source: STATES_SOURCE_ID,
                sourceLayer: STATES_SOURCE_LAYER,
                id: hoveredStateIdRef.current,
              },
              { hover: false },
            );
            hoveredStateIdRef.current = null;
          }
          map.getCanvas().style.cursor = "";
          if (uf || name) {
            popup
              .setLngLat(event.lngLat)
              .setText(name && uf ? `${name} (${uf})` : (name ?? uf ?? ""))
              .addTo(map);
          }
          return;
        }

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
        clearStateHoverPreview(map, hoveredStateIdRef);
        clearRegionHoverPreview(map, hoveredRegionRef);
        clearBiomeHoverPreview(map, hoveredBoundaryRef);

        map.getCanvas().style.cursor = "";
        popup.remove();
      });

      map.on("click", (event) => {
        const clickedMunicipality =
          mapModeRef.current === "platform" &&
          map.getLayer(MUNICIPALITY_HOVER_LAYER_ID)
            ? (map.queryRenderedFeatures(event.point, {
                layers: [MUNICIPALITY_HOVER_LAYER_ID],
              })[0] as MapGeoJSONFeature | undefined)
            : undefined;
        const rawMunicipalityCode =
          clickedMunicipality?.properties?.CD_MUN ?? clickedMunicipality?.id;
        const municipalityCode =
          typeof rawMunicipalityCode === "string" ||
          typeof rawMunicipalityCode === "number"
            ? String(rawMunicipalityCode)
            : null;

        if (municipalityCode) {
          log("municipality click", {
            municipalityCode,
            featureId: clickedMunicipality?.id,
          });

          if (selectedMunicipalityCodeRef.current === municipalityCode) {
            clearSelectedMunicipalitySelection(map);
          } else {
            onSelectedMunicipalityCodeChangeRef.current?.(municipalityCode);
          }

          return;
        }

        const clickedFeature = map.getLayer(STATES_FILL_LAYER_ID)
          ? (map.queryRenderedFeatures(event.point, {
              layers: [STATES_FILL_LAYER_ID],
            })[0] as MapGeoJSONFeature | undefined)
          : undefined;

        const uf =
          (clickedFeature?.properties?.SIGLA_UF as string | undefined) ??
          (clickedFeature?.properties?.uf as string | undefined) ??
          (clickedFeature?.properties?.sigla as string | undefined) ??
          (typeof clickedFeature?.id === "string"
            ? clickedFeature.id
            : undefined);

        // --- Spatial area click interception ---
        // Before processing as a state click, check if the click should
        // change the spatial scope (biome/region) or be blocked (biome mode).
        const spatialResult = resolveSpatialClick(event.point, uf);

        if (spatialResult === "block") {
          log("spatial click blocked (biome mode, no state selection)", {
            uf,
            spatialArea: spatialAreaRef.current,
          });
          return;
        }

        if (spatialResult !== null) {
          log("spatial click: switching scope", {
            uf,
            from: {
              spatialArea: spatialAreaRef.current,
              spatialValue: spatialValueRef.current,
            },
            to: spatialResult,
          });
          if (mapModeRef.current === "platform") {
            clearSelectedMunicipalitySelection(map);
          }
          onSpatialSelectionChangeRef.current?.(spatialResult);
          return;
        }

        // --- Normal state click flow ---
        if (!uf) {
          if (mapModeRef.current === "platform") {
            clearSelectedMunicipalitySelection(map);
          }
          return;
        }

        const allowedUfs = allowedStateUfsRef.current;
        if (allowedUfs && !allowedUfs.has(uf.toLowerCase())) {
          log("state click ignored: outside active interest area", {
            uf,
            allowedUfs,
          });
          if (mapModeRef.current === "platform") {
            clearSelectedMunicipalitySelection(map);
          }
          return;
        }

        if (mapModeRef.current === "platform") {
          clearSelectedMunicipalitySelection(map);
        }

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
        // --- Municipality hover ---
        map.on("mousemove", MUNICIPALITY_HOVER_LAYER_ID, (event) => {
          const municipalityFeature = event.features?.[0] as
            MapGeoJSONFeature | undefined;
          const municipalityLabel = buildMunicipalityLabel(municipalityFeature);

          map.getCanvas().style.cursor = "pointer";

          if (municipalityLabel) {
            popup.setLngLat(event.lngLat).setText(municipalityLabel).addTo(map);
          }

          if (municipalityFeature?.id) {
            if (hoveredMunicipalityIdRef.current !== null) {
              map.setFeatureState(
                {
                  source: MUNICIPALITY_SOURCE_ID,
                  sourceLayer: MUNICIPALITY_SOURCE_LAYER,
                  id: hoveredMunicipalityIdRef.current,
                },
                { hover: false },
              );
            }
            hoveredMunicipalityIdRef.current = municipalityFeature.id;
            map.setFeatureState(
              {
                source: MUNICIPALITY_SOURCE_ID,
                sourceLayer: MUNICIPALITY_SOURCE_LAYER,
                id: hoveredMunicipalityIdRef.current,
              },
              { hover: true },
            );
          }
        });

        map.on("mouseleave", MUNICIPALITY_HOVER_LAYER_ID, () => {
          map.getCanvas().style.cursor = "";
          popup.remove();

          if (hoveredMunicipalityIdRef.current !== null) {
            map.setFeatureState(
              {
                source: MUNICIPALITY_SOURCE_ID,
                sourceLayer: MUNICIPALITY_SOURCE_LAYER,
                id: hoveredMunicipalityIdRef.current,
              },
              { hover: false },
            );
          }
          hoveredMunicipalityIdRef.current = null;
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
    hoveredMunicipalityIdRef,
    hoveredBoundaryRef,
    hoveredRegionRef,
    onSelectedMunicipalityCodeChangeRef,
    onSpatialSelectionChangeRef,
    selectedMunicipalityCodeRef,
    spatialAreaRef,
    spatialValueRef,
    resolveSpatialClick,
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
    } catch {}
  }, [layerOpacity, mapRef, mapInstanceVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    map.setLayoutProperty(
      OSM_LAYER_ID,
      "visibility",
      basemap === "osm" ? "visible" : "none",
    );
    map.setLayoutProperty(
      SATELLITE_LAYER_ID,
      "visibility",
      basemap === "satellite" ? "visible" : "none",
    );
  }, [basemap, mapRef, mapInstanceVersion]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    try {
      ensureSpatialBoundaryLayer(
        map,
        spatialBoundaryGeoJson ?? null,
        showStatesBorder,
        allowedStateUfs,
        spatialValue,
      );
    } catch {
      // Best-effort: if style is in transition, the next syncMapLayers will retry.
    }
  }, [
    spatialBoundaryGeoJson,
    allowedStateUfs,
    showStatesBorder,
    spatialValue,
    mapRef,
    mapInstanceVersion,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    let pendingRetry = false;

    const sync = () => {
      try {
        ensureReferenceOverlayLayers(
          map,
          referenceOverlayTileUrls ?? EMPTY_TILE_URL_MAP,
        );
      } catch {
        // Ignore
      }

      if (typeof map.isStyleLoaded === "function" && !map.isStyleLoaded() && !pendingRetry) {
        pendingRetry = true;
        const retry = () => {
          map.off?.("styledata", retry);
          map.off?.("idle", retry);
          pendingRetry = false;
          sync();
        };
        map.once?.("styledata", retry);
        map.once?.("idle", retry);
      }
    };

    sync();

    map.on?.("styledata", sync);
    return () => {
      map.off?.("styledata", sync);
    };
  }, [referenceOverlayTileUrls, mapRef, mapInstanceVersion]);

  return (
    <div className="w-full h-full">
      <div className={className} ref={mapContainerRef} />
    </div>
  );
};

export default Map;
