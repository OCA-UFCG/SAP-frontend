import type { AddLayerObject, ExpressionSpecification } from "maplibre-gl";
import {
  CLASSIFICATION_MIN_ZOOM,
  CLASSIFICATION_OVERVIEW_SOURCE,
  CLASSIFICATION_TILE_SOURCE,
  ensureClassificationOverviewSource,
  type ClassificationSourceRef,
  type FeatureStateCapableMap,
  type LayerCapableMap,
  type MunicipalityOverviewGeoJson,
  type SourceCapableMap,
} from "@/components/Map/classificationLayers";
import { MUNICIPALITY_SOURCE_ID } from "@/components/Map/municipalityLayers";

export const INDEX_CHOROPLETH_LAYER_ID = "index-choropleth-fills";
export const INDEX_CHOROPLETH_OUTLINE_LAYER_ID = "index-choropleth-outline";
export const INDEX_CHOROPLETH_OVERVIEW_LAYER_ID =
  "index-choropleth-overview-fills";
export const INDEX_CHOROPLETH_OVERVIEW_OUTLINE_LAYER_ID =
  "index-choropleth-overview-outline";
export const INDEX_CHOROPLETH_STATE_KEY = "indexChoroplethClass";

const OUTLINE_COLOR = "#666666";
const OUTLINE_OPACITY = 0.45;

export const INDEX_CHOROPLETH_SOURCES: readonly ClassificationSourceRef[] = [
  CLASSIFICATION_TILE_SOURCE,
  CLASSIFICATION_OVERVIEW_SOURCE,
];

const FILL_LAYER_IDS = [
  INDEX_CHOROPLETH_LAYER_ID,
  INDEX_CHOROPLETH_OVERVIEW_LAYER_ID,
] as const;

/**
 * A cor de cada faixa do índice, escolhida pela classe gravada em feature-state.
 *
 * A expressão é montada a partir da paleta do índice — e não fixa no módulo
 * como a da AMFE — porque cada índice publicado no catálogo traz as suas
 * próprias faixas e cores. O município sem classe fica transparente: é o mesmo
 * "sem dado" que o painel mostra, e não a primeira cor da paleta.
 */
export function buildChoroplethFillColor(
  palette: readonly string[],
): ExpressionSpecification {
  const branches = palette.flatMap((color, classIndex) => [
    ["==", ["feature-state", INDEX_CHOROPLETH_STATE_KEY], classIndex],
    color,
  ]);
  return [
    "case",
    ...branches,
    "transparent",
  ] as unknown as ExpressionSpecification;
}

export function buildChoroplethFillOpacity(
  palette: readonly string[],
  opacity: number,
): ExpressionSpecification {
  const branches = palette.flatMap((_color, classIndex) => [
    ["==", ["feature-state", INDEX_CHOROPLETH_STATE_KEY], classIndex],
    opacity,
  ]);
  return ["case", ...branches, 0] as unknown as ExpressionSpecification;
}

interface ChoroplethZoomRange {
  minzoom?: number;
  maxzoom?: number;
}

function addChoroplethLayerPair(
  map: LayerCapableMap,
  { source, sourceLayer }: ClassificationSourceRef,
  ids: { fill: string; outline: string },
  zoomRange: ChoroplethZoomRange,
  palette: readonly string[],
  opacity: number,
) {
  const sourceLayerSpec = sourceLayer ? { "source-layer": sourceLayer } : {};

  map.addLayer({
    id: ids.fill,
    type: "fill",
    source,
    ...sourceLayerSpec,
    ...zoomRange,
    paint: {
      "fill-color": buildChoroplethFillColor(palette),
      "fill-opacity": buildChoroplethFillOpacity(palette, opacity),
    },
  } as AddLayerObject);

  map.addLayer({
    id: ids.outline,
    type: "line",
    source,
    ...sourceLayerSpec,
    ...zoomRange,
    paint: {
      "line-color": OUTLINE_COLOR,
      "line-opacity": buildChoroplethFillOpacity(palette, OUTLINE_OPACITY),
      "line-width": 0.6,
    },
  } as AddLayerObject);
}

/**
 * Garante as camadas da coropleta do índice: os tiles do zoom 5 para cima e o
 * GeoJSON de visão geral abaixo disso, pelo mesmo motivo da AMFE — o
 * `brazil-cities.mbtiles` declara `minzoom: 5` e o MapLibre não faz underzoom.
 *
 * @example
 * ensureIndexChoroplethLayers(map, ["#fee", "#f00"], overviewGeoJson, 0.85);
 */
export function ensureIndexChoroplethLayers(
  map: SourceCapableMap,
  palette: readonly string[],
  overviewGeoJson: MunicipalityOverviewGeoJson | null,
  opacity: number,
) {
  if (!map.getSource(MUNICIPALITY_SOURCE_ID)) return;

  if (!map.getLayer(INDEX_CHOROPLETH_LAYER_ID)) {
    addChoroplethLayerPair(
      map,
      CLASSIFICATION_TILE_SOURCE,
      {
        fill: INDEX_CHOROPLETH_LAYER_ID,
        outline: INDEX_CHOROPLETH_OUTLINE_LAYER_ID,
      },
      { minzoom: CLASSIFICATION_MIN_ZOOM },
      palette,
      opacity,
    );
  }

  if (!overviewGeoJson || map.getLayer(INDEX_CHOROPLETH_OVERVIEW_LAYER_ID)) {
    return;
  }

  ensureClassificationOverviewSource(map, overviewGeoJson);
  addChoroplethLayerPair(
    map,
    CLASSIFICATION_OVERVIEW_SOURCE,
    {
      fill: INDEX_CHOROPLETH_OVERVIEW_LAYER_ID,
      outline: INDEX_CHOROPLETH_OVERVIEW_OUTLINE_LAYER_ID,
    },
    { maxzoom: CLASSIFICATION_MIN_ZOOM },
    palette,
    opacity,
  );
}

export interface ChoroplethPaintCapableMap extends Pick<
  LayerCapableMap,
  "getLayer"
> {
  setPaintProperty(
    layerId: string,
    name: string,
    value: ExpressionSpecification,
  ): void;
}

export function applyIndexChoroplethPaint(
  map: ChoroplethPaintCapableMap,
  palette: readonly string[],
  opacity: number,
) {
  for (const layerId of FILL_LAYER_IDS) {
    if (!map.getLayer(layerId)) continue;
    map.setPaintProperty(
      layerId,
      "fill-color",
      buildChoroplethFillColor(palette),
    );
    map.setPaintProperty(
      layerId,
      "fill-opacity",
      buildChoroplethFillOpacity(palette, opacity),
    );
  }
}

export function removeIndexChoroplethLayers(map: {
  getLayer(id: string): unknown;
  removeLayer(id: string): void;
}) {
  for (const layerId of [
    INDEX_CHOROPLETH_LAYER_ID,
    INDEX_CHOROPLETH_OUTLINE_LAYER_ID,
    INDEX_CHOROPLETH_OVERVIEW_LAYER_ID,
    INDEX_CHOROPLETH_OVERVIEW_OUTLINE_LAYER_ID,
  ]) {
    if (map.getLayer(layerId)) map.removeLayer(layerId);
  }
}

/**
 * Grava a faixa de cada município em feature-state e devolve os códigos
 * escritos, para a próxima troca de período limpar só o que pintou.
 */
export function applyIndexChoroplethStates(
  map: FeatureStateCapableMap,
  classByCode: Readonly<Record<string, number>>,
): Set<string> {
  const applied = new Set<string>();

  for (const [code, classIndex] of Object.entries(classByCode)) {
    for (const { source, sourceLayer } of INDEX_CHOROPLETH_SOURCES) {
      map.setFeatureState(
        { source, sourceLayer, id: code },
        { [INDEX_CHOROPLETH_STATE_KEY]: classIndex },
      );
    }
    applied.add(code);
  }

  return applied;
}

/** Remove só a chave da coropleta: `hover` e `selected` são de outras camadas. */
export function clearIndexChoroplethStates(
  map: FeatureStateCapableMap,
  codes: Iterable<string>,
) {
  for (const code of codes) {
    for (const { source, sourceLayer } of INDEX_CHOROPLETH_SOURCES) {
      map.removeFeatureState(
        { source, sourceLayer, id: code },
        INDEX_CHOROPLETH_STATE_KEY,
      );
    }
  }
}
