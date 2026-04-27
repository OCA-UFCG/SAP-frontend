"use client";

import bbox from "@turf/bbox";
import { FeatureCollection, Geometry } from "geojson";
import maplibregl, {
  ExpressionSpecification,
  GeoJSONSource,
  LngLatBoundsLike,
  MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useMemo, useRef } from "react";
import geometria from "../../data/geometria.json";
import type { CDIFeatureProperties, CDIVectorData } from "@/lib/geo";

interface MapProps {
  minZoom?: number;
  center: [number, number];
  zoom?: number;
  markers?: Array<{ position: [number, number]; label: string }>;
  className?: string;
  showStatesBorder?: boolean;
  dadosCDI?: CDIVectorData;
  estadoSelecionado: string;
  tileLayerUrl?: string | null;
  onStateSelect?: (uf: string) => void;
}

interface FeatureProperties {
  codarea: string;
  info: {
    id: number;
    sigla: string;
    nome: string;
    regiao: {
      id: number;
      sigla: string;
      nome: string;
    };
  };
}

type EstadoProperties = FeatureProperties;

const MAP_SOURCE_ID = "osm-base";
const STATES_SOURCE_ID = "brazil-states";
// Must match the vector source-layer inside your MBTiles.
// Your MBTiles should expose the UF abbreviation as a property (`SIGLA_UF`) so we can promote it to the feature id.
// Must match the vector layer name inside the MBTiles.
// Example: tippecanoe `-l brazilstates`.
const STATES_SOURCE_LAYER = "brazilstates";
const CDI_SOURCE_ID = "cdi-data";
const GEE_SOURCE_ID = "gee-tiles";
const STATES_FILL_LAYER_ID = "state-fills";
const STATES_BORDER_LAYER_ID = "state-borders";
const CDI_LAYER_ID = "cdi-layer";
const GEE_LAYER_ID = "gee-layer";

const CDI_FILL_EXPRESSION: ExpressionSpecification = [
  "match",
  ["to-number", ["get", "classe_cdi"]],
  0,
  "#E4E5E2",
  1,
  "#FFCC80",
  2,
  "#FB8C00",
  3,
  "#BF360C",
  4,
  "#A3B18A",
  5,
  "#588157",
  "transparent",
];

const DEFAULT_CENTER: [number, number] = [-15.749997, -47.9499962];
const MAP_FIT_BOUNDS_PADDING = 200;
const MAP_FOCUS_ANIMATION_DURATION = 1200;
const MAP_STATE_FOCUS_MAX_ZOOM = 4.5;

const smoothCameraEasing = (progress: number) => 1 - Math.pow(1 - progress, 3);

const BASE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    [MAP_SOURCE_ID]: {
      type: "raster",
      tiles: ["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
  layers: [
    {
      id: MAP_SOURCE_ID,
      type: "raster",
      source: MAP_SOURCE_ID,
    },
  ],
};

const buildCdiGeoJson = (
  dadosCDI?: CDIVectorData,
): FeatureCollection<Geometry, CDIFeatureProperties> => ({
  type: "FeatureCollection",
  features: dadosCDI?.features ?? [],
});

const isValidLatLngTuple = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === "number" &&
  Number.isFinite(value[0]) &&
  typeof value[1] === "number" &&
  Number.isFinite(value[1]);

const ensureMapLayers = (
  map: maplibregl.Map,
  showStatesBorder: boolean,
  hasCdiData: boolean,
  tileLayerUrl?: string | null,
) => {
  if (!map.getSource(CDI_SOURCE_ID)) {
    map.addSource(CDI_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
  }

  if (!map.getLayer(CDI_LAYER_ID)) {
    map.addLayer({
      id: CDI_LAYER_ID,
      type: "fill",
      source: CDI_SOURCE_ID,
      paint: {
        "fill-color": CDI_FILL_EXPRESSION,
        "fill-opacity": 1,
      },
      layout: {
        visibility: hasCdiData ? "visible" : "none",
      },
    });
  }

  // ── GEE raster tile layer ──
  if (tileLayerUrl) {
    if (!map.getSource(GEE_SOURCE_ID)) {
      map.addSource(GEE_SOURCE_ID, {
        type: "raster",
        tiles: [tileLayerUrl],
        tileSize: 256,
      });
    } else {
      // Only rebuild the raster source when the tiles URL actually changed.
      const existingSourceSpec = map.getStyle()?.sources?.[GEE_SOURCE_ID] as
        | { tiles?: string[] }
        | undefined;
      const existingTileUrl = existingSourceSpec?.tiles?.[0];

      if (existingTileUrl !== tileLayerUrl) {
        if (map.getLayer(GEE_LAYER_ID)) map.removeLayer(GEE_LAYER_ID);
        if (map.getSource(GEE_SOURCE_ID)) map.removeSource(GEE_SOURCE_ID);
        map.addSource(GEE_SOURCE_ID, {
          type: "raster",
          tiles: [tileLayerUrl],
          tileSize: 256,
        });
      }
    }

    if (!map.getLayer(GEE_LAYER_ID)) {
      map.addLayer(
        {
          id: GEE_LAYER_ID,
          type: "raster",
          source: GEE_SOURCE_ID,
          paint: {
            "raster-opacity": 0.85,
            "raster-resampling": "nearest",
          },
        },
        // Insert before state fills so states remain interactive on top
        map.getLayer(STATES_FILL_LAYER_ID) ? STATES_FILL_LAYER_ID : undefined,
      );
    }
  } else {
    // Remove GEE layer if URL was cleared
    if (map.getLayer(GEE_LAYER_ID)) map.removeLayer(GEE_LAYER_ID);
    if (map.getSource(GEE_SOURCE_ID)) map.removeSource(GEE_SOURCE_ID);
  }

  if (!map.getSource(STATES_SOURCE_ID)) {
    // Some runtimes (and some worker contexts) are picky about relative URLs.
    // Use an absolute URL to avoid `Failed to construct 'Request'` errors.
    const statesTilesUrl =
      typeof window === "undefined"
        ? "/api/tiles/{z}/{x}/{y}"
        : `${window.location.origin}/api/tiles/{z}/{x}/{y}`;

    map.addSource(STATES_SOURCE_ID, {
      type: "vector",
      tiles: [statesTilesUrl],
      // Stable IDs are required for feature-state hover/selected.
      // Ensure your vector tiles include `SIGLA_UF` for each feature.
      promoteId: { [STATES_SOURCE_LAYER]: "SIGLA_UF" },
    });
  }

  if (!map.getLayer(STATES_FILL_LAYER_ID)) {
    map.addLayer({
      id: STATES_FILL_LAYER_ID,
      type: "fill",
      source: STATES_SOURCE_ID,
      "source-layer": STATES_SOURCE_LAYER,
      paint: {
        "fill-color": "#000000",
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          0.1,
          ["boolean", ["feature-state", "selected"], false],
          0.1,
          0,
        ],
      },
      layout: {
        // Keep fills visible (even if transparent) so the layer remains interactive.
        visibility: "visible",
      },
    });
  }

  if (!map.getLayer(STATES_BORDER_LAYER_ID)) {
    map.addLayer({
      id: STATES_BORDER_LAYER_ID,
      type: "line",
      source: STATES_SOURCE_ID,
      "source-layer": STATES_SOURCE_LAYER,
      paint: {
        "line-color": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          "#000000",
          ["boolean", ["feature-state", "selected"], false],
          "#000000",
          "#3388ff",
        ],
        "line-width": [
          "case",
          ["boolean", ["feature-state", "hover"], false],
          4,
          ["boolean", ["feature-state", "selected"], false],
          4,
          1,
        ],
        "line-opacity": 0.65,
      },
      layout: {
        visibility: showStatesBorder ? "visible" : "none",
      },
    });
  }
};

const Map = ({
  center = [51.505, -0.09],
  zoom = 13,
  minZoom = 3,
  markers = [],
  className = "h-full w-full",
  dadosCDI,
  showStatesBorder = true,
  estadoSelecionado,
  tileLayerUrl,
  onStateSelect,
}: MapProps) => {
  const debugEnabled = process.env.NODE_ENV !== "production";
  const geoBrasil = geometria as unknown as FeatureCollection<
    Geometry,
    EstadoProperties
  >;
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const popupRef = useRef(
    new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    }),
  );
  const mapDebugIdRef = useRef<string>(Math.random().toString(36).slice(2, 8));
  const hoveredStateIdRef = useRef<string | number | null>(null);
  const selectedStateIdRef = useRef<string | number | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const selectedStateRef = useRef<string>(estadoSelecionado);
  const onStateSelectRef = useRef<MapProps["onStateSelect"]>(onStateSelect);
  const tileLayerUrlRef = useRef<string | null | undefined>(tileLayerUrl);
  const showStatesBorderRef = useRef<boolean>(showStatesBorder);
  const hasCdiDataRef = useRef<boolean>(Boolean(dadosCDI));
  const cdiGeoJsonRef = useRef<
    FeatureCollection<Geometry, CDIFeatureProperties>
  >(buildCdiGeoJson(dadosCDI));
  const currentBoundsRef = useRef<LngLatBoundsLike | null>(null);
  const normalizedCenter = isValidLatLngTuple(center) ? center : DEFAULT_CENTER;
  const initialViewRef = useRef({
    center: normalizedCenter,
    zoom,
    minZoom,
  });

  const currentBounds = useMemo((): LngLatBoundsLike => {
    if (estadoSelecionado === "BR") {
      const [minLng, minLat, maxLng, maxLat] = bbox(geoBrasil);
      return [
        [minLng, minLat],
        [maxLng, maxLat],
      ];
    }

    const featureEstado = geoBrasil.features.find(
      (feature) => feature.properties?.info.sigla === estadoSelecionado,
    );

    if (featureEstado) {
      const [minLng, minLat, maxLng, maxLat] = bbox(featureEstado);
      return [
        [minLng, minLat],
        [maxLng, maxLat],
      ];
    }

    const [minLng, minLat, maxLng, maxLat] = bbox(geoBrasil);
    return [
      [minLng, minLat],
      [maxLng, maxLat],
    ];
  }, [estadoSelecionado, geoBrasil]);

  const cdiGeoJson = useMemo(() => buildCdiGeoJson(dadosCDI), [dadosCDI]);

  const pendingStyleSyncRef = useRef(false);
  const pendingSelectedSyncRef = useRef(false);

  const log = useCallback(
    (...args: unknown[]) => {
      if (!debugEnabled) return;

      console.log(`[SAP Map ${mapDebugIdRef.current}]`, ...args);
    },
    [debugEnabled],
  );

  const warn = useCallback(
    (...args: unknown[]) => {
      if (!debugEnabled) return;

      console.warn(`[SAP Map ${mapDebugIdRef.current}]`, ...args);
    },
    [debugEnabled],
  );

  const safeGetFeatureState = useCallback(
    (map: maplibregl.Map, id: string | number) => {
      try {
        return map.getFeatureState({
          source: STATES_SOURCE_ID,
          sourceLayer: STATES_SOURCE_LAYER,
          id,
        });
      } catch {
        return null;
      }
    },
    [],
  );

  const applySelectedFeatureState = useCallback(
    (map: maplibregl.Map, next: string) => {
      const prev = selectedStateIdRef.current;

      log("applySelectedFeatureState", {
        prev,
        next,
        styleLoaded: map.isStyleLoaded(),
        hasStatesSource: Boolean(map.getSource(STATES_SOURCE_ID)),
      });

      if (prev && prev !== next) {
        try {
          map.setFeatureState(
            {
              source: STATES_SOURCE_ID,
              sourceLayer: STATES_SOURCE_LAYER,
              id: prev,
            },
            // Clear both `selected` and `hover` to avoid stuck outlines when
            // mouse events don't fire during camera animations/style reloads.
            { selected: false, hover: false },
          );
          log("cleared prev selected", {
            prev,
            prevFeatureState: safeGetFeatureState(map, prev),
          });
          selectedStateIdRef.current = null;
        } catch (err) {
          warn("failed clearing prev selected", { prev, err });
          throw err;
        }
      }

      if (next && next !== "BR") {
        try {
          selectedStateIdRef.current = next;
          map.setFeatureState(
            {
              source: STATES_SOURCE_ID,
              sourceLayer: STATES_SOURCE_LAYER,
              id: next,
            },
            { selected: true },
          );
          log("set next selected", {
            next,
            nextFeatureState: safeGetFeatureState(map, next),
          });
        } catch (err) {
          warn("failed setting next selected", { next, err });
          throw err;
        }
      }
    },
    [log, safeGetFeatureState, warn],
  );

  const scheduleSelectedStateSync = useCallback(
    (reason: string) => {
      const map = mapRef.current;
      if (!map) return;
      if (pendingSelectedSyncRef.current) return;

      log("scheduleSelectedStateSync", {
        reason,
        styleLoaded: map.isStyleLoaded(),
        hasStatesSource: Boolean(map.getSource(STATES_SOURCE_ID)),
        selectedStateRef: selectedStateRef.current,
        selectedStateIdRef: selectedStateIdRef.current,
      });

      pendingSelectedSyncRef.current = true;
      let didRun = false;
      const run = (trigger: "styledata" | "idle") => {
        if (didRun) return;
        didRun = true;

        pendingSelectedSyncRef.current = false;

        // If the map instance was replaced/unmounted, bail.
        if (mapRef.current !== map) return;

        const next = selectedStateRef.current;
        log("selectedStateSync fired", {
          trigger,
          reason,
          next,
          styleLoaded: map.isStyleLoaded(),
          hasStatesSource: Boolean(map.getSource(STATES_SOURCE_ID)),
        });
        try {
          if (!map.getSource(STATES_SOURCE_ID)) {
            scheduleSelectedStateSync("retry: states source missing");
            return;
          }
          applySelectedFeatureState(map, next);
        } catch (err) {
          // Best-effort: schedule one more attempt on the next styledata.
          warn("selectedStateSync apply failed", { reason, trigger, err });
          scheduleSelectedStateSync("retry: setFeatureState threw");
        }

        void reason;
      };

      // Depending on MapLibre internals, `isStyleLoaded()` can remain false
      // while sources/tiles are loading; `idle` is a more reliable point.
      map.once("styledata", () => run("styledata"));
      map.once("idle", () => run("idle"));
    },
    [applySelectedFeatureState, log, warn],
  );

  useEffect(() => {
    selectedStateRef.current = estadoSelecionado;
    onStateSelectRef.current = onStateSelect;
    tileLayerUrlRef.current = tileLayerUrl;
    showStatesBorderRef.current = showStatesBorder;
    hasCdiDataRef.current = Boolean(dadosCDI);
    cdiGeoJsonRef.current = cdiGeoJson;
    currentBoundsRef.current = currentBounds;
  }, [
    estadoSelecionado,
    onStateSelect,
    tileLayerUrl,
    showStatesBorder,
    dadosCDI,
    cdiGeoJson,
    currentBounds,
  ]);

  const syncMapLayers = useCallback(
    function syncMapLayersImpl() {
      const map = mapRef.current;
      if (!map) return;

      // IMPORTANT: `map.isStyleLoaded()` can be false while tiles are loading.
      // Toggle-off should still remove the raster layer immediately.
      if (!tileLayerUrlRef.current) {
        try {
          if (map.getLayer(GEE_LAYER_ID)) map.removeLayer(GEE_LAYER_ID);
          if (map.getSource(GEE_SOURCE_ID)) map.removeSource(GEE_SOURCE_ID);
        } catch {
          // Best-effort cleanup; if style isn't ready, we'll retry below.
        }
      }

      if (!map.isStyleLoaded()) {
        if (pendingStyleSyncRef.current) return;
        pendingStyleSyncRef.current = true;

        let didRetry = false;
        const retry = (trigger: "styledata" | "idle") => {
          if (didRetry) return;
          didRetry = true;
          pendingStyleSyncRef.current = false;
          log("syncMapLayers retry", { trigger });
          syncMapLayersImpl();
        };

        // When the style finishes (re)loading, re-apply the latest refs.
        map.once("styledata", () => retry("styledata"));
        map.once("idle", () => retry("idle"));
        return;
      }

      log("syncMapLayers", {
        styleLoaded: map.isStyleLoaded(),
        hasStatesSource: Boolean(map.getSource(STATES_SOURCE_ID)),
        tileLayerUrl: tileLayerUrlRef.current,
        showStatesBorder: showStatesBorderRef.current,
        hasCdiData: hasCdiDataRef.current,
      });

      ensureMapLayers(
        map,
        showStatesBorderRef.current,
        hasCdiDataRef.current,
        tileLayerUrlRef.current,
      );

      // Re-apply the currently selected state after (re)creating layers/sources.
      try {
        if (map.getSource(STATES_SOURCE_ID)) {
          applySelectedFeatureState(map, selectedStateRef.current);
        }
      } catch (err) {
        warn("syncMapLayers applySelectedFeatureState failed", { err });
        scheduleSelectedStateSync("syncMapLayers");
      }

      const cdiSource = map.getSource(CDI_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      cdiSource?.setData(cdiGeoJsonRef.current);

      map.setLayoutProperty(STATES_FILL_LAYER_ID, "visibility", "visible");
      map.setLayoutProperty(
        STATES_BORDER_LAYER_ID,
        "visibility",
        showStatesBorderRef.current ? "visible" : "none",
      );
      map.setLayoutProperty(
        CDI_LAYER_ID,
        "visibility",
        hasCdiDataRef.current ? "visible" : "none",
      );
    },
    [applySelectedFeatureState, scheduleSelectedStateSync, log, warn],
  );

  useEffect(() => {
    syncMapLayers();
  }, [syncMapLayers, cdiGeoJson, dadosCDI, showStatesBorder, tileLayerUrl]);

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
      scrollZoom: true,
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

    map.on("load", () => {
      log("map load");
      syncMapLayers();

      const boundsToFit = currentBoundsRef.current;
      if (boundsToFit) {
        map.fitBounds(boundsToFit, {
          padding: MAP_FIT_BOUNDS_PADDING,
          animate: false,
        });
      }

      // Apply initial selected state via feature-state (works with vector tiles).
      if (selectedStateRef.current && selectedStateRef.current !== "BR") {
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

        map.getCanvas().style.cursor = "default";

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

        log("state click", {
          uf,
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
            applySelectedFeatureState(map, uf);
          } else {
            scheduleSelectedStateSync("click: states source missing");
          }
        } catch (err) {
          warn("click optimistic apply failed", { uf, err });
          scheduleSelectedStateSync("click: setFeatureState threw");
        }

        onStateSelectRef.current?.(uf);
      });
    });

    mapRef.current = map;

    return () => {
      popup.remove();
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [
    syncMapLayers,
    applySelectedFeatureState,
    scheduleSelectedStateSync,
    log,
    warn,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

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
    applySelectedFeatureState,
    scheduleSelectedStateSync,
    log,
    warn,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    map.fitBounds(currentBounds, {
      padding: MAP_FIT_BOUNDS_PADDING,
      animate: true,
      duration: MAP_FOCUS_ANIMATION_DURATION,
      easing: smoothCameraEasing,
      maxZoom: MAP_STATE_FOCUS_MAX_ZOOM,
    });
  }, [currentBounds]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = markers
      .filter(({ position }) => isValidLatLngTuple(position))
      .map(({ position, label }) =>
        new maplibregl.Marker()
          .setLngLat([position[1], position[0]])
          .setPopup(new maplibregl.Popup({ offset: 12 }).setText(label))
          .addTo(map),
      );
  }, [markers]);

  return (
    <div className="w-full h-full">
      <div className={className} ref={mapContainerRef} />
    </div>
  );
};

export default Map;
