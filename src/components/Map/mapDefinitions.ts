import maplibregl, { ExpressionSpecification } from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";
import { BRAZIL_RASTER_BOUNDS } from "./mapBounds";
import {
  MUNICIPALITY_HOVER_LAYER_ID,
  ensureMunicipalityLayers,
} from "./municipalityLayers";
import { ensureClassificationLayer } from "./classificationLayers";
import { getActiveBoundaryNames } from "@/utils/spatialScope";
import { REFERENCE_LAYER_IDS } from "@/components/MapLayerContext/mapLayerState";

export type MapMode = "demo" | "platform";

const MAP_SOURCE_ID = "osm-base";
export const OSM_LAYER_ID = "osm-layer";
export const STATES_SOURCE_ID = "brazil-states";
export const STATES_SOURCE_LAYER = "brazilstates";
export const CDI_SOURCE_ID = "cdi-data";
export const GEE_SOURCE_ID = "gee-tiles";
export const SATELLITE_SOURCE_ID = "satellite-base";
export const SATELLITE_LAYER_ID = "satellite-layer";
export const STATES_FILL_LAYER_ID = "state-fills";
export const STATES_BORDER_LAYER_ID = "state-borders";
export const CDI_LAYER_ID = "cdi-layer";
export const GEE_LAYER_ID = "gee-layer";
export const SPATIAL_BOUNDARY_SOURCE_ID = "spatial-boundary";
export const SPATIAL_BOUNDARY_LAYER_ID = "spatial-boundary-outline";
export const REF_OVERLAY_SOURCE_PREFIX = "ref-overlay-src-";
export const REF_OVERLAY_LAYER_PREFIX = "ref-overlay-lyr-";
export const SPATIAL_BOUNDARY_FILL_LAYER_ID = "spatial-boundary-fills";

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
    [SATELLITE_SOURCE_ID]: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "&copy; Esri, Maxar, Earthstar Geographics",
    },
  },
  layers: [
    {
      id: OSM_LAYER_ID,
      type: "raster",
      source: MAP_SOURCE_ID,
    },
    {
      id: SATELLITE_LAYER_ID,
      type: "raster",
      source: SATELLITE_SOURCE_ID,
      layout: { visibility: "none" },
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
  layerOpacity = 0.85,
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
        { tiles?: string[] } | undefined;
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
            "raster-opacity": layerOpacity,
            "raster-resampling": "nearest",
          },
        },
        map.getLayer(SPATIAL_BOUNDARY_LAYER_ID)
          ? SPATIAL_BOUNDARY_LAYER_ID
          : map.getLayer(SPATIAL_BOUNDARY_FILL_LAYER_ID)
            ? SPATIAL_BOUNDARY_FILL_LAYER_ID
            : map.getLayer(STATES_FILL_LAYER_ID)
              ? STATES_FILL_LAYER_ID
              : undefined,
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
  ensureClassificationLayer(map);
};

const EMPTY_FEATURE_COLLECTION: FeatureCollection<Geometry> = {
  type: "FeatureCollection",
  features: [],
};

export const ensureSpatialBoundaryLayer = (
  map: maplibregl.Map,
  boundaryGeoJson: FeatureCollection<Geometry, { name: string }> | null,
  showStatesBorder: boolean,
  allowedStateUfs: Set<string> | null = null,
  spatialValue: string | null = null,
) => {
  const hasBoundary =
    boundaryGeoJson !== null && boundaryGeoJson.features.length > 0;

  // --- State borders: visibility + filter ---
  if (map.getLayer(STATES_BORDER_LAYER_ID)) {
    if (hasBoundary) {
      // Biome/Semiarid/ASD: hide state borders entirely
      map.setLayoutProperty(STATES_BORDER_LAYER_ID, "visibility", "none");
      map.setFilter?.(STATES_BORDER_LAYER_ID, null);
    } else if (allowedStateUfs) {
      // Region: show only borders of states within the region
      const upperUfs = Array.from(allowedStateUfs).map((uf) =>
        uf.toUpperCase(),
      );
      map.setLayoutProperty(
        STATES_BORDER_LAYER_ID,
        "visibility",
        showStatesBorder ? "visible" : "none",
      );
      map.setFilter?.(STATES_BORDER_LAYER_ID, [
        "in",
        ["get", "SIGLA_UF"],
        ["literal", upperUfs],
      ]);
    } else {
      // National: show all state borders, no filter
      map.setLayoutProperty(
        STATES_BORDER_LAYER_ID,
        "visibility",
        showStatesBorder ? "visible" : "none",
      );
      map.setFilter?.(STATES_BORDER_LAYER_ID, null);
    }
  }

  // --- Spatial boundary overlay ---
  if (hasBoundary) {
    if (!map.getSource(SPATIAL_BOUNDARY_SOURCE_ID)) {
      map.addSource(SPATIAL_BOUNDARY_SOURCE_ID, {
        type: "geojson",
        data: boundaryGeoJson,
        promoteId: "name",
      });
    } else {
      const source = map.getSource(
        SPATIAL_BOUNDARY_SOURCE_ID,
      ) as maplibregl.GeoJSONSource;
      source.setData(boundaryGeoJson);
    }

    if (!map.getLayer(SPATIAL_BOUNDARY_LAYER_ID)) {
      // Insert the boundary outline right before the state fills,
      // so it sits above the GEE raster but below the interactive fills.
      map.addLayer(
        {
          id: SPATIAL_BOUNDARY_LAYER_ID,
          type: "line",
          source: SPATIAL_BOUNDARY_SOURCE_ID,
          paint: {
            "line-color": "#3388ff",
            "line-width": 3,
            "line-opacity": 0.85,
          },
        },
        map.getLayer(STATES_FILL_LAYER_ID) ? STATES_FILL_LAYER_ID : undefined,
      );
    }

    // A fonte pode trazer a área inteira (os seis biomas) porque a camada de
    // preenchimento precisa deles para o hover e o clique. O contorno, não: ele
    // marca o recorte ativo, então filtra pelo nome da seleção.
    if (spatialValue && map.getLayer(SPATIAL_BOUNDARY_LAYER_ID)) {
      map.setFilter(SPATIAL_BOUNDARY_LAYER_ID, [
        "in",
        ["get", "name"],
        ["literal", [...getActiveBoundaryNames(spatialValue)]],
      ]);
    }

    // Interactive fill layer for click/hover detection on spatial boundaries.
    // Transparent by default; shows a dark highlight preview on hover.
    if (!map.getLayer(SPATIAL_BOUNDARY_FILL_LAYER_ID)) {
      map.addLayer(
        {
          id: SPATIAL_BOUNDARY_FILL_LAYER_ID,
          type: "fill",
          source: SPATIAL_BOUNDARY_SOURCE_ID,
          paint: {
            "fill-color": "#000000",
            "fill-opacity": [
              "case",
              ["boolean", ["feature-state", "hover"], false],
              0.22,
              0,
            ],
          },
        },
        map.getLayer(STATES_FILL_LAYER_ID) ? STATES_FILL_LAYER_ID : undefined,
      );
    }
  } else {
    // Remove boundary layers when not needed
    if (map.getLayer(SPATIAL_BOUNDARY_FILL_LAYER_ID)) {
      map.removeLayer(SPATIAL_BOUNDARY_FILL_LAYER_ID);
    }
    if (map.getLayer(SPATIAL_BOUNDARY_LAYER_ID)) {
      map.removeLayer(SPATIAL_BOUNDARY_LAYER_ID);
    }
    if (map.getSource(SPATIAL_BOUNDARY_SOURCE_ID)) {
      // Clear data before removing to avoid stale rendering
      const source = map.getSource(
        SPATIAL_BOUNDARY_SOURCE_ID,
      ) as maplibregl.GeoJSONSource;
      source.setData(EMPTY_FEATURE_COLLECTION);
      map.removeSource(SPATIAL_BOUNDARY_SOURCE_ID);
    }
  }
};

export type ReferenceOverlayTileUrls = ReadonlyMap<string, string | undefined>;

const referenceOverlaySourceId = (overlayId: string) =>
  `${REF_OVERLAY_SOURCE_PREFIX}${overlayId}`;

const referenceOverlayLayerId = (overlayId: string) =>
  `${REF_OVERLAY_LAYER_PREFIX}${overlayId}`;

const removeReferenceOverlay = (map: maplibregl.Map, overlayId: string) => {
  const sourceId = referenceOverlaySourceId(overlayId);
  const layerId = referenceOverlayLayerId(overlayId);
  try {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
    if (map.getSource(sourceId)) map.removeSource(sourceId);
  } catch {
    // Best-effort cleanup
  }
};

/**
 * Esconde o território sem destruir a camada. O MapLibre para de pedir tiles de
 * uma source que nenhuma camada visível usa, e guarda os que já baixou; remover
 * a source jogaria esse cache fora, e religar o mesmo território baixaria tudo
 * do Earth Engine de novo. Só a troca de URL de tiles ainda recria a source.
 */
const hideReferenceOverlay = (map: maplibregl.Map, overlayId: string) => {
  const layerId = referenceOverlayLayerId(overlayId);
  if (!map.getLayer(layerId)) return;

  map.setLayoutProperty(layerId, "visibility", "none");
};

const buildReferenceOverlaySource = (
  tileUrl: string,
): maplibregl.RasterSourceSpecification => ({
  type: "raster",
  tiles: [tileUrl],
  tileSize: 256,
  bounds: BRAZIL_RASTER_BOUNDS,
});

/**
 * Camada âncora: o território entra ACIMA de todo dado de análise — o raster do
 * GEE, o fill do CDI e a coropleta da AMFE, que é empilhada logo abaixo do hover
 * de município — e abaixo das camadas de hover, seleção e limites, que precisam
 * continuar legíveis por cima dele. Enquanto o território entrava por baixo,
 * aplicar um índice o cobria e ele deixava de ser visível.
 */
const resolveReferenceOverlayAnchor = (map: maplibregl.Map) => {
  if (map.getLayer(MUNICIPALITY_HOVER_LAYER_ID)) {
    return MUNICIPALITY_HOVER_LAYER_ID;
  }
  if (map.getLayer(STATES_BORDER_LAYER_ID)) return STATES_BORDER_LAYER_ID;
  return undefined;
};

const applyReferenceOverlay = (
  map: maplibregl.Map,
  overlayId: string,
  tileUrl: string,
) => {
  const sourceId = referenceOverlaySourceId(overlayId);
  const layerId = referenceOverlayLayerId(overlayId);
  const existingSource = map.getSource(sourceId) as
    maplibregl.RasterTileSource | undefined;

  // Trocar a URL exige recriar a source: `tiles` não é editável in-place.
  if (existingSource && existingSource.tiles?.[0] !== tileUrl) {
    removeReferenceOverlay(map, overlayId);
  }

  if (!map.getSource(sourceId)) {
    map.addSource(sourceId, buildReferenceOverlaySource(tileUrl));
  }

  if (!map.getLayer(layerId)) {
    map.addLayer(
      {
        id: layerId,
        type: "raster",
        source: sourceId,
        paint: {},
        layout: { visibility: "visible" },
      },
      resolveReferenceOverlayAnchor(map),
    );
    return;
  }

  // Reexibe a camada que continuou no mapa depois de o território ser
  // desligado. Repor o mesmo valor não repinta nada: o MapLibre ignora um
  // `setLayoutProperty` que não muda a propriedade.
  map.setLayoutProperty(layerId, "visibility", "visible");
};

/**
 * Sincroniza as camadas de referência (quilombolas, assentamentos, etc.) com o
 * conjunto de URLs de tiles ativas: esconde as que saíram e desenha as que
 * entraram, sempre acima da camada de análise.
 *
 * Retorna `false` quando o MapLibre ainda está montando o estilo e recusou a
 * escrita — nesse caso o chamador deve reagendar em `styledata`/`idle`.
 *
 * const applied = ensureReferenceOverlayLayers(map, new Map([["quilombolas", url]]));
 */
export const ensureReferenceOverlayLayers = (
  map: maplibregl.Map,
  activeTileUrls: ReferenceOverlayTileUrls,
): boolean => {
  try {
    for (const overlayId of REFERENCE_LAYER_IDS) {
      if (!activeTileUrls.get(overlayId)) hideReferenceOverlay(map, overlayId);
    }

    for (const [overlayId, tileUrl] of activeTileUrls) {
      if (tileUrl) applyReferenceOverlay(map, overlayId, tileUrl);
    }
    return true;
  } catch {
    // `addSource`/`addLayer` lançam "Style is not done loading." enquanto o
    // MapLibre ainda parseia o estilo (troca de basemap, primeiro render).
    // Não dá para usar `map.isStyleLoaded()` como guarda aqui: ele também
    // retorna false enquanto QUALQUER source ainda busca tiles, o que durante
    // cliques seguidos deixaria a adição bloqueada quase o tempo todo.
    return false;
  }
};
