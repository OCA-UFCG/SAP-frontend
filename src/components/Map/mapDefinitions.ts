import maplibregl, { ExpressionSpecification } from "maplibre-gl";
import { BRAZIL_RASTER_BOUNDS } from "./mapBounds";
import { ensureMunicipalityLayers } from "./municipalityLayers";

export type MapMode = "demo" | "platform";

const MAP_SOURCE_ID = "osm-base";
export const STATES_SOURCE_ID = "brazil-states";
export const STATES_SOURCE_LAYER = "brazilstates";
export const CDI_SOURCE_ID = "cdi-data";
export const GEE_SOURCE_ID = "gee-tiles";
export const STATES_FILL_LAYER_ID = "state-fills";
export const STATES_BORDER_LAYER_ID = "state-borders";
export const CDI_LAYER_ID = "cdi-layer";
export const GEE_LAYER_ID = "gee-layer";

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

export const BASE_STYLE: maplibregl.StyleSpecification = {
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

const removeLayerIfPresent = (map: maplibregl.Map, layerId: string) => {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
};

const removeSourceIfPresent = (map: maplibregl.Map, sourceId: string) => {
  if (map.getSource(sourceId)) map.removeSource(sourceId);
};

const removeProtectedRasterLayer = (map: maplibregl.Map) => {
  removeLayerIfPresent(map, GEE_LAYER_ID);
  removeSourceIfPresent(map, GEE_SOURCE_ID);
};

export const ensureMapLayers = (
  map: maplibregl.Map,
  mapMode: MapMode,
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

  if (mapMode === "demo") {
    removeProtectedRasterLayer(map);
  } else if (tileLayerUrl) {
    if (!map.getSource(GEE_SOURCE_ID)) {
      map.addSource(GEE_SOURCE_ID, {
        type: "raster",
        tiles: [tileLayerUrl],
        tileSize: 256,
        bounds: BRAZIL_RASTER_BOUNDS,
      });
    } else {
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
          bounds: BRAZIL_RASTER_BOUNDS,
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
        map.getLayer(STATES_FILL_LAYER_ID) ? STATES_FILL_LAYER_ID : undefined,
      );
    }
  } else {
    if (map.getLayer(GEE_LAYER_ID)) map.removeLayer(GEE_LAYER_ID);
    if (map.getSource(GEE_SOURCE_ID)) map.removeSource(GEE_SOURCE_ID);
  }

  if (!map.getSource(STATES_SOURCE_ID)) {
    const statesTilesUrl =
      typeof window === "undefined"
        ? "/api/tiles/{z}/{x}/{y}"
        : `${window.location.origin}/api/tiles/{z}/{x}/{y}`;

    map.addSource(STATES_SOURCE_ID, {
      type: "vector",
      tiles: [statesTilesUrl],
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

  ensureMunicipalityLayers(map, STATES_BORDER_LAYER_ID);
};
