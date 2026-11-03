import * as maplibregl from "maplibre-gl";
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

// Um arquivo por grupo: quem liga um grupo só baixa os tiles dele.
const territoryTilesPath = (layerId: string) =>
  `/api/tiles/{z}/{x}/{y}?tileset=territories-${layerId}`;

// O MapLibre baixa os tiles num worker, onde um endereço relativo não resolve.
export const resolveTerritoryTilesUrl = (layerId: string) =>
  typeof window === "undefined"
    ? territoryTilesPath(layerId)
    : `${window.location.origin}${territoryTilesPath(layerId)}`;

const vectorSourceId = (layerId: string) => `ref-vector-src-${layerId}`;
const maskSourceId = (layerId: string) => `ref-vector-mask-src-${layerId}`;
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

// Com o Brasil inteiro à vista os nomes poluem o mapa: aparecem a partir de
// uma região, e o mouse e o clique só pegam o território já de perto. Antes
// disso, valem os do estado e do município, como sem os territórios.
const LABEL_MIN_ZOOM = 7;
// Em destaque, o grupo é o assunto do mapa: os nomes dele aparecem desde o
// Brasil inteiro, e a disputa por espaço deixa só os maiores territórios. Sem
// isso, os únicos nomes à vista eram os de país e cidade do mapa base.
const HIGHLIGHTED_LABEL_MIN_ZOOM = territoryVectorTiles.minZoom;
export const TERRITORY_INTERACTION_MIN_ZOOM = 8;
export const LABEL_FONT = "Noto Sans Bold";

const TILE_BOUNDS = territoryVectorTiles.maskBounds as [
  number,
  number,
  number,
  number,
];

export interface VectorOverlayPaint {
  fillOpacity: maplibregl.ExpressionSpecification | number;
  lineOpacity: number;
  /**
   * Os nomes ficam por cima de tudo, até do escuro do destaque: com outro
   * grupo em destaque, os deste somem em vez de poluir o escuro.
   */
  labelOpacity: number;
  /** O grupo está em destaque: os nomes aparecem já de longe. */
  highlighted: boolean;
  /** O território marcado (busca ou clique), com o contorno mais grosso. */
  selected: { name: string; municipality: string } | null;
  beforeId: string | undefined;
}

const ensureVectorSource = (map: maplibregl.Map, layerId: string) => {
  if (map.getSource(vectorSourceId(layerId))) return;
  map.addSource(vectorSourceId(layerId), {
    type: "vector",
    tiles: [resolveTerritoryTilesUrl(layerId)],
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
  property: Parameters<maplibregl.Map["setPaintProperty"]>[1],
  value: Parameters<maplibregl.Map["setPaintProperty"]>[2],
) => {
  if (!samePaint(map.getPaintProperty(layerId, property), value)) {
    map.setPaintProperty(layerId, property, value);
  }
};

// Sem marcado, um filtro que nada satisfaz: nenhum território tem nome vazio.
const selectedFilter = (
  selected: VectorOverlayPaint["selected"],
): maplibregl.FilterSpecification => [
  "all",
  ["==", ["get", "name"], selected?.name ?? ""],
  ["==", ["get", "municipio"], selected?.municipality ?? ""],
];

/**
 * Desenha o grupo (interior, contorno, contorno do marcado e nome) ou só
 * ajusta a opacidade e o marcado, se ele já está no mapa.
 *
 * applyVectorReferenceOverlay(map, "terras_indigenas", {
 *   fillOpacity: 0.45, lineOpacity: 1, labelOpacity: 1, highlighted: false,
 *   selected: { name: "Kiriri", municipality: "Banzaê" },
 *   beforeId: anchor,
 * });
 */
export function applyVectorReferenceOverlay(
  map: maplibregl.Map,
  layerId: string,
  paint: VectorOverlayPaint,
) {
  const swatch = REFERENCE_LAYER_SWATCHES[layerId as ReferenceLayerId];
  ensureVectorSource(map, layerId);

  const fillId = vectorFillLayerId(layerId);
  const haloId = vectorHaloLayerId(layerId);
  const outlineId = vectorOutlineLayerId(layerId);
  const selectedId = vectorSelectedLayerId(layerId);
  const labelId = vectorLabelLayerId(layerId);
  const common = { source: vectorSourceId(layerId), "source-layer": layerId };
  const labelMinZoom = paint.highlighted
    ? HIGHLIGHTED_LABEL_MIN_ZOOM
    : LABEL_MIN_ZOOM;

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
        filter: selectedFilter(paint.selected),
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
      source: vectorSourceId(layerId),
      "source-layer": `${layerId}_rotulos`,
      minzoom: labelMinZoom,
      layout: {
        "text-field": ["get", "name"],
        "text-font": [LABEL_FONT],
        "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 10, 13],
        "text-max-width": 8,
        "symbol-sort-key": ["-", ["get", "area"]],
      },
      paint: {
        "text-color": swatch.outline,
        "text-halo-color": "#FFFFFF",
        "text-halo-width": 1.5,
        "text-opacity": paint.labelOpacity,
      },
    });
    return;
  }

  setPaint(map, fillId, "fill-opacity", paint.fillOpacity);
  setPaint(map, haloId, "line-opacity", paint.lineOpacity);
  setPaint(map, outlineId, "line-opacity", paint.lineOpacity);
  setPaint(map, labelId, "text-opacity", paint.labelOpacity);
  if (map.getLayer(labelId)?.minzoom !== labelMinZoom) {
    map.setLayerZoomRange(labelId, labelMinZoom, 24);
  }
  const filter = selectedFilter(paint.selected);
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
    if (map.getSource(vectorSourceId(layerId))) {
      map.removeSource(vectorSourceId(layerId));
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
    for (const layerId of VECTOR_REFERENCE_LAYER_IDS) {
      if (map.getSource(maskSourceId(layerId))) {
        map.removeSource(maskSourceId(layerId));
      }
    }
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
  const sourceId = maskSourceId(layerId);
  // Outro grupo em destaque: a máscara dele sai, com a fonte.
  const existing = map.getLayer(VECTOR_MASK_LAYER_ID);
  if (existing && existing.source !== sourceId) {
    removeLayers(map, [VECTOR_MASK_LAYER_ID, VECTOR_MASK_WORLD_LAYER_ID]);
    map.removeSource(existing.source);
  }

  if (!map.getSource(sourceId)) {
    // Fonte própria só para parar de pedir tiles em `maskMaxZoom`: de perto o
    // mapa amplia o último nível. A borda ampliada fica sob o contorno largo
    // do território.
    map.addSource(sourceId, {
      type: "vector",
      tiles: [resolveTerritoryTilesUrl(layerId)],
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
        source: sourceId,
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
        source: sourceId,
        "source-layer": `${layerId}_mascara`,
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
  municipality: string;
}

/**
 * O território vetorial sob o ponto, se algum grupo vetorial estiver ligado e
 * o mapa estiver perto o bastante. Com dois sobrepostos, vale o de cima.
 *
 * const territory = findReferenceTerritoryAtPoint(map, event.point);
 */
export function findReferenceTerritoryAtPoint(
  map: maplibregl.Map,
  point: maplibregl.PointLike,
): ClickedReferenceTerritory | null {
  if (map.getZoom() < TERRITORY_INTERACTION_MIN_ZOOM) return null;

  const layers = [...VECTOR_REFERENCE_LAYER_IDS]
    .map(vectorFillLayerId)
    .filter((layerId) => map.getLayer(layerId));
  if (!layers.length) return null;

  const feature = map.queryRenderedFeatures(point, { layers })[0];
  const name = feature?.properties?.name;
  if (!feature || typeof name !== "string" || !name) return null;

  return {
    layerId: feature.sourceLayer as ReferenceLayerId,
    name,
    municipality: String(feature.properties.municipio ?? ""),
  };
}
