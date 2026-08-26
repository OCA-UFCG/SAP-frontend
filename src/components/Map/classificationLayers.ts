import type {
  AddLayerObject,
  ExpressionSpecification,
  SourceSpecification,
} from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";
import {
  MUNICIPALITY_HOVER_LAYER_ID,
  MUNICIPALITY_SOURCE_ID,
  MUNICIPALITY_SOURCE_LAYER,
} from "./municipalityLayers";

/** Alvo de feature-state. `sourceLayer` só existe em source vetorial. */
export interface FeatureStateTarget {
  source: string;
  sourceLayer?: string;
  id: string;
}

export interface ClassificationSourceRef {
  source: string;
  sourceLayer?: string;
}

/**
 * Subconjunto de `maplibregl.Map` que este módulo consome. Uma instância real
 * do MapLibre satisfaz estas interfaces estruturalmente; declará-las aqui
 * mantém o módulo testável sem um canvas WebGL.
 */
export interface LayerCapableMap {
  getLayer(id: string): unknown;
  getSource(id: string): unknown;
  addLayer(layer: AddLayerObject, beforeId?: string): void;
}

export interface SourceCapableMap extends LayerCapableMap {
  addSource(id: string, source: SourceSpecification): void;
}

export interface FeatureStateCapableMap {
  setFeatureState(
    target: FeatureStateTarget,
    state: Record<string, unknown>,
  ): void;
  removeFeatureState(target: FeatureStateTarget, key?: string): void;
}

export const CLASSIFICATION_LAYER_ID = "amfe-classification-fills";
export const CLASSIFICATION_OUTLINE_LAYER_ID = "amfe-classification-outline";
export const CLASSIFICATION_OVERVIEW_SOURCE_ID = "amfe-cities-overview";
export const CLASSIFICATION_OVERVIEW_LAYER_ID =
  "amfe-classification-overview-fills";
export const CLASSIFICATION_OVERVIEW_OUTLINE_LAYER_ID =
  "amfe-classification-overview-outline";
export const CLASSIFICATION_OVERVIEW_CODE_PROPERTY = "c";
export const CLASSIFICATION_STATE_KEY = "amfeClassification";
export const EXCLUDED_STATE_KEY = "amfeExcluded";

/**
 * O `brazil-cities.mbtiles` declara `minzoom: 5` e MapLibre não faz underzoom
 * de source vetorial: abaixo disso não existe tile de município para pintar.
 * Este é o limite entre as duas fontes da coropleta — os tiles daqui para cima,
 * o GeoJSON de visão geral daqui para baixo.
 */
export const CLASSIFICATION_MIN_ZOOM = 5;

export const CLASSIFICATION_TILE_SOURCE: ClassificationSourceRef = {
  source: MUNICIPALITY_SOURCE_ID,
  sourceLayer: MUNICIPALITY_SOURCE_LAYER,
};
export const CLASSIFICATION_OVERVIEW_SOURCE: ClassificationSourceRef = {
  source: CLASSIFICATION_OVERVIEW_SOURCE_ID,
};
export const CLASSIFICATION_SOURCES: readonly ClassificationSourceRef[] = [
  CLASSIFICATION_TILE_SOURCE,
  CLASSIFICATION_OVERVIEW_SOURCE,
];

export type MunicipalityOverviewGeoJson = FeatureCollection<
  Geometry,
  { [CLASSIFICATION_OVERVIEW_CODE_PROPERTY]: string }
>;

/** Prioridade 0 (muito baixa) → 4 (muito alta), na ordem devolvida pelo backend. */
export const CLASSIFICATION_COLORS = [
  "#00FF00",
  "#7FFF00",
  "#FFFF00",
  "#FFA500",
  "#FF0000",
] as const;

const EXCLUDED_COLOR = "#B0B0B0";
const CLASSIFIED_OPACITY = 0.85;
const EXCLUDED_OPACITY = 0.25;
const OUTLINE_COLOR = "#666666";
const CLASSIFIED_OUTLINE_OPACITY = 0.45;
const EXCLUDED_OUTLINE_OPACITY = 0.2;

export interface MunicipalityClassification {
  /** Código IBGE de 7 dígitos → nível de prioridade (0–4). */
  classificationByCode: Readonly<Record<string, number>>;
  /** Códigos presentes na área mas sem dado suficiente para ranquear. */
  excludedCodes: readonly string[];
}

/**
 * Monta uma cadeia `case` que testa o nível de classificação guardado em
 * feature-state. Preferimos comparações explícitas a `to-number` porque
 * `to-number(null)` coage para 0 e pintaria todo município sem dado como
 * prioridade muito baixa.
 */
const buildClassificationCases = (
  valueForLevel: (level: number) => string | number,
  excludedValue: string | number,
  fallback: string | number,
) => {
  const branches = CLASSIFICATION_COLORS.flatMap((_color, level) => [
    ["==", ["feature-state", CLASSIFICATION_STATE_KEY], level],
    valueForLevel(level),
  ]);

  // O cast é necessário porque a tipagem de ExpressionSpecification não
  // acompanha arrays montados dinamicamente.
  return [
    "case",
    ...branches,
    ["boolean", ["feature-state", EXCLUDED_STATE_KEY], false],
    excludedValue,
    fallback,
  ] as unknown as ExpressionSpecification;
};

export const CLASSIFICATION_FILL_COLOR = buildClassificationCases(
  (level) => CLASSIFICATION_COLORS[level],
  EXCLUDED_COLOR,
  "transparent",
);

export const CLASSIFICATION_FILL_OPACITY = buildClassificationCases(
  () => CLASSIFIED_OPACITY,
  EXCLUDED_OPACITY,
  0,
);

export const CLASSIFICATION_OUTLINE_OPACITY = buildClassificationCases(
  () => CLASSIFIED_OUTLINE_OPACITY,
  EXCLUDED_OUTLINE_OPACITY,
  0,
);

interface ClassificationLayerIds {
  fill: string;
  outline: string;
}

interface ClassificationZoomRange {
  minzoom?: number;
  maxzoom?: number;
}

const addClassificationLayerPair = (
  map: LayerCapableMap,
  { source, sourceLayer }: ClassificationSourceRef,
  ids: ClassificationLayerIds,
  zoomRange: ClassificationZoomRange,
  beforeLayerId?: string,
) => {
  const sourceLayerSpec = sourceLayer ? { "source-layer": sourceLayer } : {};

  map.addLayer(
    {
      id: ids.fill,
      type: "fill",
      source,
      ...sourceLayerSpec,
      ...zoomRange,
      paint: {
        "fill-color": CLASSIFICATION_FILL_COLOR,
        "fill-opacity": CLASSIFICATION_FILL_OPACITY,
      },
    } as AddLayerObject,
    beforeLayerId,
  );

  map.addLayer(
    {
      id: ids.outline,
      type: "line",
      source,
      ...sourceLayerSpec,
      ...zoomRange,
      paint: {
        "line-color": OUTLINE_COLOR,
        "line-opacity": CLASSIFICATION_OUTLINE_OPACITY,
        "line-width": [
          "interpolate",
          ["linear"],
          ["zoom"],
          CLASSIFICATION_MIN_ZOOM,
          0.6,
          12,
          1.4,
        ],
      },
    } as AddLayerObject,
    beforeLayerId,
  );
};

const resolveBeforeLayerId = (map: LayerCapableMap) =>
  map.getLayer(MUNICIPALITY_HOVER_LAYER_ID)
    ? MUNICIPALITY_HOVER_LAYER_ID
    : undefined;

/**
 * Adiciona a coropleta dos tiles de município, válida do zoom 5 para cima.
 *
 * @example
 * ensureClassificationLayer(map);
 */
export const ensureClassificationLayer = (map: LayerCapableMap) => {
  if (map.getLayer(CLASSIFICATION_LAYER_ID)) return;
  if (!map.getSource(MUNICIPALITY_SOURCE_ID)) return;

  addClassificationLayerPair(
    map,
    CLASSIFICATION_TILE_SOURCE,
    { fill: CLASSIFICATION_LAYER_ID, outline: CLASSIFICATION_OUTLINE_LAYER_ID },
    { minzoom: CLASSIFICATION_MIN_ZOOM },
    resolveBeforeLayerId(map),
  );
};

export const ensureClassificationOverviewLayer = (
  map: SourceCapableMap,
  overviewGeoJson: MunicipalityOverviewGeoJson,
) => {
  if (map.getLayer(CLASSIFICATION_OVERVIEW_LAYER_ID)) return;

  if (!map.getSource(CLASSIFICATION_OVERVIEW_SOURCE_ID)) {
    map.addSource(CLASSIFICATION_OVERVIEW_SOURCE_ID, {
      type: "geojson",
      data: overviewGeoJson,
      promoteId: CLASSIFICATION_OVERVIEW_CODE_PROPERTY,
    });
  }

  addClassificationLayerPair(
    map,
    CLASSIFICATION_OVERVIEW_SOURCE,
    {
      fill: CLASSIFICATION_OVERVIEW_LAYER_ID,
      outline: CLASSIFICATION_OVERVIEW_OUTLINE_LAYER_ID,
    },
    { maxzoom: CLASSIFICATION_MIN_ZOOM },
    resolveBeforeLayerId(map),
  );
};

const featureRefs = (
  code: string,
  sources: readonly ClassificationSourceRef[],
): FeatureStateTarget[] =>
  sources.map(({ source, sourceLayer }) => ({ source, sourceLayer, id: code }));

/**
 * Grava a classificação de cada município em feature-state. MapLibre guarda
 * esse estado por source e o reaplica conforme os tiles carregam, então não é
 * necessário esperar o tile do município estar em tela.
 *
 * @example
 * const applied = applyClassificationFeatureStates(map, analysis);
 */
export const applyClassificationFeatureStates = (
  map: FeatureStateCapableMap,
  { classificationByCode, excludedCodes }: MunicipalityClassification,
  sources: readonly ClassificationSourceRef[] = CLASSIFICATION_SOURCES,
): Set<string> => {
  const applied = new Set<string>();

  const write = (code: string, state: Record<string, unknown>) => {
    for (const target of featureRefs(code, sources)) {
      map.setFeatureState(target, state);
    }
    applied.add(code);
  };

  for (const [code, level] of Object.entries(classificationByCode)) {
    write(code, { [CLASSIFICATION_STATE_KEY]: level });
  }

  for (const code of excludedCodes) {
    if (applied.has(code)) continue;
    write(code, { [EXCLUDED_STATE_KEY]: true });
  }

  return applied;
};

/**
 * Remove apenas as chaves da AMFE, preservando `hover` e `selected` que as
 * outras camadas do mapa mantêm no mesmo feature-state.
 */
export const clearClassificationFeatureStates = (
  map: FeatureStateCapableMap,
  codes: Iterable<string>,
  sources: readonly ClassificationSourceRef[] = CLASSIFICATION_SOURCES,
) => {
  for (const code of codes) {
    for (const target of featureRefs(code, sources)) {
      map.removeFeatureState(target, CLASSIFICATION_STATE_KEY);
      map.removeFeatureState(target, EXCLUDED_STATE_KEY);
    }
  }
};
