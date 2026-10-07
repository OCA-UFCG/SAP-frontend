import maplibregl, {
  ExpressionSpecification,
  MapGeoJSONFeature,
} from "maplibre-gl";

export const MUNICIPALITY_SOURCE_ID = "brazil-cities";
export const MUNICIPALITY_SOURCE_LAYER = "brazilcities";
export const MUNICIPALITY_BORDER_LAYER_ID = "municipality-borders";
export const MUNICIPALITY_HOVER_LAYER_ID = "municipality-hover-fills";
export const MUNICIPALITY_MIN_ZOOM = 7;
export const MUNICIPALITY_BORDER_MIN_ZOOM = 7;
export const MUNICIPALITY_SELECTED_BORDER_MIN_ZOOM = 5;

const MUNICIPALITY_TILES_PATH = "/api/tiles/{z}/{x}/{y}?tileset=cities";

const resolveMunicipalityTilesUrl = () => {
  if (typeof window === "undefined") return MUNICIPALITY_TILES_PATH;
  return `${window.location.origin}${MUNICIPALITY_TILES_PATH}`;
};

const getStringProperty = (
  properties: Record<string, unknown> | undefined,
  key: string,
) => {
  const value = properties?.[key];
  return typeof value === "string" && value.length > 0 ? value : null;
};

export const buildMunicipalityLabel = (
  feature: MapGeoJSONFeature | undefined,
) => {
  const properties = feature?.properties as Record<string, unknown> | undefined;
  const name = getStringProperty(properties, "NM_MUN");
  const stateCode = getStringProperty(properties, "SIGLA_UF");

  if (!name) return null;
  return stateCode ? `${name} (${stateCode})` : name;
};

const ensureMunicipalitySource = (map: maplibregl.Map) => {
  if (!map.getSource(MUNICIPALITY_SOURCE_ID)) {
    map.addSource(MUNICIPALITY_SOURCE_ID, {
      type: "vector",
      tiles: [resolveMunicipalityTilesUrl()],
      promoteId: { [MUNICIPALITY_SOURCE_LAYER]: "CD_MUN" },
    });
  }
};

/**
 * Hover e seleção marcam o município do mesmo jeito: contorno preto, sem
 * preenchimento. Como o único sinal agora é a linha, ela precisa ser mais
 * grossa que a divisa comum para ser notada.
 */
const MUNICIPALITY_HIGHLIGHTED: ExpressionSpecification = [
  "any",
  ["boolean", ["feature-state", "hover"], false],
  ["boolean", ["feature-state", "selected"], false],
];

const ensureMunicipalityHoverLayer = (
  map: maplibregl.Map,
  beforeLayerId?: string,
) => {
  if (!map.getLayer(MUNICIPALITY_HOVER_LAYER_ID)) {
    map.addLayer(
      {
        id: MUNICIPALITY_HOVER_LAYER_ID,
        type: "fill",
        source: MUNICIPALITY_SOURCE_ID,
        "source-layer": MUNICIPALITY_SOURCE_LAYER,
        minzoom: MUNICIPALITY_MIN_ZOOM,
        // Transparente de propósito. A camada existe só para o
        // `queryRenderedFeatures` do hover e do clique achar o município; o véu
        // escuro que ela desenhava antes somava-se à cor do índice e fazia o
        // município sob o cursor parecer de outra faixa da legenda. Quem marca
        // a seleção e o hover é o contorno preto, logo abaixo.
        paint: {
          "fill-color": "#000000",
          "fill-opacity": 0,
        },
      },
      beforeLayerId,
    );
  }
};

const ensureMunicipalityBorderLayer = (
  map: maplibregl.Map,
  beforeLayerId?: string,
) => {
  if (!map.getLayer(MUNICIPALITY_BORDER_LAYER_ID)) {
    map.addLayer(
      {
        id: MUNICIPALITY_BORDER_LAYER_ID,
        type: "line",
        source: MUNICIPALITY_SOURCE_ID,
        "source-layer": MUNICIPALITY_SOURCE_LAYER,
        minzoom: MUNICIPALITY_SELECTED_BORDER_MIN_ZOOM,
        paint: {
          "line-color": [
            "case",
            MUNICIPALITY_HIGHLIGHTED,
            "#000000",
            "#6B7280",
          ],
          "line-opacity": [
            "step",
            ["zoom"],
            ["case", MUNICIPALITY_HIGHLIGHTED, 0.95, 0],
            MUNICIPALITY_BORDER_MIN_ZOOM,
            ["case", MUNICIPALITY_HIGHLIGHTED, 0.95, 0.25],
          ],
          // O `case` fica dentro das paradas, e não em volta do `interpolate`:
          // o MapLibre aceita uma única subexpressão de zoom por propriedade e
          // recusa a camada inteira quando há duas.
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            MUNICIPALITY_SELECTED_BORDER_MIN_ZOOM,
            ["case", MUNICIPALITY_HIGHLIGHTED, 2, 0.9],
            12,
            ["case", MUNICIPALITY_HIGHLIGHTED, 3.2, 1.8],
          ],
        },
      },
      beforeLayerId,
    );
  }
};

export const ensureMunicipalityLayers = (
  map: maplibregl.Map,
  beforeLayerId?: string,
) => {
  ensureMunicipalitySource(map);
  ensureMunicipalityHoverLayer(map, beforeLayerId);
  ensureMunicipalityBorderLayer(map, beforeLayerId);
};
