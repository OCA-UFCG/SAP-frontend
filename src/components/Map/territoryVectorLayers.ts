import maplibregl from "maplibre-gl";
import type { Feature, Polygon } from "geojson";
import territoryVectorTiles from "@/config/territoryVectorTiles.json";
import {
  REFERENCE_LAYER_SWATCHES,
  type ReferenceLayerId,
} from "@/components/MapLayerContext/mapLayerState";

/**
 * Os grupos de território desenhados a partir de tiles vetoriais nossos
 * (`scripts/build-territory-tiles.mjs`), e não das imagens do Earth Engine.
 *
 * Com o contorno no navegador, o mapa escreve o nome de cada território, sabe
 * qual foi clicado e desenha sem esperar o Earth Engine: cada tile tem poucos KB
 * e sai de um arquivo no próprio servidor, contra 1,4 s a 2,6 s por imagem.
 */
export const VECTOR_REFERENCE_LAYER_IDS: ReadonlySet<string> = new Set(
  territoryVectorTiles.layers,
);

export const isVectorReferenceLayer = (layerId: string) =>
  VECTOR_REFERENCE_LAYER_IDS.has(layerId);

const TERRITORY_TILES_PATH = "/api/tiles/{z}/{x}/{y}?tileset=territories";

// O MapLibre baixa os tiles num worker, onde um endereço relativo não resolve.
export const resolveTerritoryTilesUrl = () =>
  typeof window === "undefined"
    ? TERRITORY_TILES_PATH
    : `${window.location.origin}${TERRITORY_TILES_PATH}`;

const VECTOR_SOURCE_ID = "ref-vector-src";
const MASK_SOURCE_ID = "ref-vector-mask-src";
const MASK_OUTSIDE_SOURCE_ID = "ref-vector-mask-outside-src";
export const VECTOR_MASK_LAYER_ID = "ref-vector-mask-lyr";
export const VECTOR_MASK_WORLD_LAYER_ID = "ref-vector-mask-world-lyr";
export const VECTOR_MASK_OUTSIDE_LAYER_ID = "ref-vector-mask-outside-lyr";

export const vectorFillLayerId = (layerId: string) =>
  `ref-vector-${layerId}-fill`;
const vectorHaloLayerId = (layerId: string) => `ref-vector-${layerId}-halo`;
const vectorOutlineLayerId = (layerId: string) =>
  `ref-vector-${layerId}-outline`;
const vectorSelectedLayerId = (layerId: string) =>
  `ref-vector-${layerId}-selected`;
const vectorLabelLayerId = (layerId: string) => `ref-vector-${layerId}-label`;

/** As camadas do grupo, de baixo para cima, sem o nome — que fica no topo. */
export const vectorOverlayLayerIds = (layerId: string) => [
  vectorFillLayerId(layerId),
  vectorHaloLayerId(layerId),
  vectorOutlineLayerId(layerId),
  vectorSelectedLayerId(layerId),
];

// Iguais às do Earth Engine (`src/app/api/ee/referenceLayers.ts`): o halo claro
// por baixo mantém a linha legível sobre as cores escuras do índice.
const OUTLINE_WIDTH_PX = 2.5;
const OUTLINE_HALO = "rgba(255, 255, 255, 0.8)";
const OUTLINE_HALO_WIDTH_PX = 4.5;
const SELECTED_OUTLINE_WIDTH_PX = 5;

// De longe só cabem os nomes dos maiores; a disputa por espaço deixa o maior.
const LABEL_MIN_ZOOM = 5;
export const LABEL_FONT = "Noto Sans Bold";

const TILE_BOUNDS = territoryVectorTiles.maskBounds as [
  number,
  number,
  number,
  number,
];

const NO_SELECTION = "";

export interface VectorOverlayPaint {
  fillOpacity: maplibregl.ExpressionSpecification | number;
  lineOpacity: number;
  /** O território marcado (busca ou clique), com o contorno mais grosso. */
  selectedName: string | null;
  beforeId: string | undefined;
}

const ensureVectorSource = (map: maplibregl.Map) => {
  if (map.getSource(VECTOR_SOURCE_ID)) return;
  map.addSource(VECTOR_SOURCE_ID, {
    type: "vector",
    tiles: [resolveTerritoryTilesUrl()],
    minzoom: territoryVectorTiles.minZoom,
    maxzoom: territoryVectorTiles.maxZoom,
    bounds: TILE_BOUNDS,
  });
};

const samePaint = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);

// Mexer no estilo dispara `styledata`, que chama a sincronização de novo: só
// escreve quando o valor mudou.
const setPaint = (
  map: maplibregl.Map,
  layerId: string,
  property: string,
  value: unknown,
) => {
  if (!samePaint(map.getPaintProperty(layerId, property), value)) {
    map.setPaintProperty(layerId, property, value);
  }
};

const selectedFilter = (
  selectedName: string | null,
): maplibregl.FilterSpecification => [
  "==",
  ["get", "name"],
  selectedName ?? NO_SELECTION,
];

/**
 * Desenha o grupo (interior, contorno, contorno do marcado e nome) ou só
 * ajusta a opacidade e o marcado, se ele já está no mapa.
 *
 * applyVectorReferenceOverlay(map, "terras_indigenas", {
 *   fillOpacity: 0.45, lineOpacity: 1, selectedName: "Kiriri", beforeId: anchor,
 * });
 */
export function applyVectorReferenceOverlay(
  map: maplibregl.Map,
  layerId: string,
  paint: VectorOverlayPaint,
) {
  const swatch = REFERENCE_LAYER_SWATCHES[layerId as ReferenceLayerId];
  ensureVectorSource(map);

  const fillId = vectorFillLayerId(layerId);
  const haloId = vectorHaloLayerId(layerId);
  const outlineId = vectorOutlineLayerId(layerId);
  const selectedId = vectorSelectedLayerId(layerId);
  const labelId = vectorLabelLayerId(layerId);
  const common = { source: VECTOR_SOURCE_ID, "source-layer": layerId };

  if (!map.getLayer(fillId)) {
    map.addLayer(
      {
        id: fillId,
        type: "fill",
        ...common,
        paint: {
          "fill-color": swatch.fill,
          "fill-opacity": paint.fillOpacity,
        },
      },
      paint.beforeId,
    );
    map.addLayer(
      {
        id: haloId,
        type: "line",
        ...common,
        paint: {
          "line-color": OUTLINE_HALO,
          "line-width": OUTLINE_HALO_WIDTH_PX,
          "line-opacity": paint.lineOpacity,
        },
      },
      paint.beforeId,
    );
    map.addLayer(
      {
        id: outlineId,
        type: "line",
        ...common,
        paint: {
          "line-color": swatch.outline,
          "line-width": OUTLINE_WIDTH_PX,
          "line-opacity": paint.lineOpacity,
        },
      },
      paint.beforeId,
    );
    map.addLayer(
      {
        id: selectedId,
        type: "line",
        ...common,
        filter: selectedFilter(paint.selectedName),
        paint: {
          "line-color": swatch.outline,
          "line-width": SELECTED_OUTLINE_WIDTH_PX,
        },
      },
      paint.beforeId,
    );
    // Sem âncora: o nome fica acima de tudo, até do escuro do destaque.
    map.addLayer({
      id: labelId,
      type: "symbol",
      source: VECTOR_SOURCE_ID,
      "source-layer": `${layerId}_rotulos`,
      minzoom: LABEL_MIN_ZOOM,
      layout: {
        "text-field": ["get", "name"],
        "text-font": [LABEL_FONT],
        "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 10, 13],
        "text-max-width": 8,
        "symbol-sort-key": ["-", ["get", "area"]],
      },
      paint: {
        "text-color": swatch.outline,
        "text-halo-color": "#FFFFFF",
        "text-halo-width": 1.5,
        "text-opacity": paint.lineOpacity,
      },
    });
    return;
  }

  setPaint(map, fillId, "fill-opacity", paint.fillOpacity);
  setPaint(map, haloId, "line-opacity", paint.lineOpacity);
  setPaint(map, outlineId, "line-opacity", paint.lineOpacity);
  setPaint(map, labelId, "text-opacity", paint.lineOpacity);
  const filter = selectedFilter(paint.selectedName);
  if (!samePaint(map.getFilter(selectedId), filter)) {
    map.setFilter(selectedId, filter);
  }
}

const removeLayers = (map: maplibregl.Map, layerIds: string[]) => {
  for (const layerId of layerIds) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
};

export function removeVectorReferenceOverlay(
  map: maplibregl.Map,
  layerId: string,
) {
  try {
    removeLayers(map, [
      ...vectorOverlayLayerIds(layerId),
      vectorLabelLayerId(layerId),
    ]);
    const stillUsed = [...VECTOR_REFERENCE_LAYER_IDS].some((id) =>
      map.getLayer(vectorFillLayerId(id)),
    );
    if (!stillUsed && map.getSource(VECTOR_SOURCE_ID)) {
      map.removeSource(VECTOR_SOURCE_ID);
    }
  } catch {
    // Best-effort cleanup
  }
}

/** O mundo com um buraco no retângulo dos tiles: o escuro de fora do Brasil. */
const OUTSIDE_TILES: Feature<Polygon> = {
  type: "Feature",
  properties: {},
  geometry: {
    type: "Polygon",
    coordinates: [
      [
        [-180, -85.06],
        [180, -85.06],
        [180, 85.06],
        [-180, 85.06],
        [-180, -85.06],
      ],
      [
        [TILE_BOUNDS[0], TILE_BOUNDS[1]],
        [TILE_BOUNDS[0], TILE_BOUNDS[3]],
        [TILE_BOUNDS[2], TILE_BOUNDS[3]],
        [TILE_BOUNDS[2], TILE_BOUNDS[1]],
        [TILE_BOUNDS[0], TILE_BOUNDS[1]],
      ],
    ],
  },
};

export function removeVectorHighlightMask(map: maplibregl.Map) {
  try {
    removeLayers(map, [
      VECTOR_MASK_OUTSIDE_LAYER_ID,
      VECTOR_MASK_WORLD_LAYER_ID,
      VECTOR_MASK_LAYER_ID,
    ]);
    if (map.getSource(MASK_SOURCE_ID)) map.removeSource(MASK_SOURCE_ID);
    if (map.getSource(MASK_OUTSIDE_SOURCE_ID)) {
      map.removeSource(MASK_OUTSIDE_SOURCE_ID);
    }
  } catch {
    // Best-effort cleanup
  }
}

/**
 * O escuro do destaque de um grupo vetorial: o retângulo do Brasil menos os
 * territórios, que vem pronto nos tiles, e o resto do mundo. O retângulo segue
 * a grade dos tiles do zoom `maskBoundsZoom`: a partir dele o resto do mundo é
 * desenhado aqui e encontra a máscara na borda de um tile, sem sobrepor. Antes
 * dele a grade é mais larga que o retângulo, e o resto do mundo vem nos
 * próprios tiles (`<grupo>_mascara_fora`). Nenhum suaviza a borda: suavizada,
 * cada emenda aparecia como uma linha mais escura.
 *
 * Devolve as camadas da máscara, de baixo para cima.
 */
export function applyVectorHighlightMask(
  map: maplibregl.Map,
  layerId: string,
  opacity: number,
  beforeId: string | undefined,
): string[] {
  const maskSourceLayer = `${layerId}_mascara`;
  const existing = map.getLayer(VECTOR_MASK_LAYER_ID) as
    { sourceLayer?: string } | undefined;
  if (existing && existing.sourceLayer !== maskSourceLayer) {
    removeLayers(map, [VECTOR_MASK_LAYER_ID, VECTOR_MASK_WORLD_LAYER_ID]);
  }

  if (!map.getSource(MASK_SOURCE_ID)) {
    // Fonte própria só para parar de pedir tiles em `maskMaxZoom`: de perto o
    // mapa amplia o último nível. A borda ampliada fica sob o contorno largo
    // do território.
    map.addSource(MASK_SOURCE_ID, {
      type: "vector",
      tiles: [resolveTerritoryTilesUrl()],
      minzoom: territoryVectorTiles.minZoom,
      maxzoom: territoryVectorTiles.maskMaxZoom,
      // Sem `bounds`: de longe o resto do mundo também vem destes tiles.
    });
  }
  if (!map.getSource(MASK_OUTSIDE_SOURCE_ID)) {
    map.addSource(MASK_OUTSIDE_SOURCE_ID, {
      type: "geojson",
      data: OUTSIDE_TILES,
    });
  }

  const maskPaint = {
    "fill-color": "#000000",
    "fill-opacity": opacity,
    "fill-antialias": false,
  };
  if (!map.getLayer(VECTOR_MASK_OUTSIDE_LAYER_ID)) {
    map.addLayer(
      {
        id: VECTOR_MASK_OUTSIDE_LAYER_ID,
        type: "fill",
        source: MASK_OUTSIDE_SOURCE_ID,
        minzoom: territoryVectorTiles.maskBoundsZoom,
        paint: maskPaint,
      },
      beforeId,
    );
  }
  if (!map.getLayer(VECTOR_MASK_WORLD_LAYER_ID)) {
    map.addLayer(
      {
        id: VECTOR_MASK_WORLD_LAYER_ID,
        type: "fill",
        source: MASK_SOURCE_ID,
        "source-layer": `${layerId}_mascara_fora`,
        maxzoom: territoryVectorTiles.maskBoundsZoom,
        paint: maskPaint,
      },
      beforeId,
    );
  }
  if (!map.getLayer(VECTOR_MASK_LAYER_ID)) {
    map.addLayer(
      {
        id: VECTOR_MASK_LAYER_ID,
        type: "fill",
        source: MASK_SOURCE_ID,
        "source-layer": maskSourceLayer,
        paint: maskPaint,
      },
      beforeId,
    );
  }

  return [
    VECTOR_MASK_OUTSIDE_LAYER_ID,
    VECTOR_MASK_WORLD_LAYER_ID,
    VECTOR_MASK_LAYER_ID,
  ];
}

export interface ClickedReferenceTerritory {
  layerId: ReferenceLayerId;
  name: string;
}

/**
 * O território vetorial sob o ponto, se algum grupo vetorial estiver ligado.
 * Com dois sobrepostos, vale o de cima.
 *
 * const territory = findReferenceTerritoryAtPoint(map, event.point);
 */
export function findReferenceTerritoryAtPoint(
  map: maplibregl.Map,
  point: maplibregl.PointLike,
): ClickedReferenceTerritory | null {
  const layers = [...VECTOR_REFERENCE_LAYER_IDS]
    .map(vectorFillLayerId)
    .filter((layerId) => map.getLayer(layerId));
  if (!layers.length) return null;

  const feature = map.queryRenderedFeatures(point, { layers })[0];
  const name = feature?.properties?.name;
  if (!feature || typeof name !== "string" || !name) return null;

  return { layerId: feature.sourceLayer as ReferenceLayerId, name };
}
