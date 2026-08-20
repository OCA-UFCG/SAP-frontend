import bbox from "@turf/bbox";
import { FeatureCollection, GeoJsonProperties, Geometry } from "geojson";
import maplibregl, { LngLatBoundsLike, MapGeoJSONFeature } from "maplibre-gl";
import geometria from "../../data/geometria.json";
import municipalityBoundsIndexData from "../../data/municipalityBounds.json";
import type { CDIFeatureProperties, CDIVectorData } from "@/lib/geo";
import { BRAZIL_TERRITORY_CODE } from "./stateSelection";
import {
  MUNICIPALITY_SOURCE_ID,
  MUNICIPALITY_SOURCE_LAYER,
} from "./municipalityLayers";

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
type MunicipalityBoundsTuple = [number, number, number, number];
type MunicipalityBoundsIndex = Record<string, MunicipalityBoundsTuple>;

const MUNICIPALITY_ID_PROPERTY = "CD_MUN";

const buildMunicipalityBoundsIndex = (
  source: Record<string, number[]>,
): MunicipalityBoundsIndex => {
  return Object.entries(source).reduce<MunicipalityBoundsIndex>(
    (index, [municipalityCode, bounds]) => {
      if (
        bounds.length !== 4 ||
        bounds.some((coordinate) => !Number.isFinite(coordinate))
      ) {
        return index;
      }

      index[municipalityCode] = [bounds[0], bounds[1], bounds[2], bounds[3]];
      return index;
    },
    {},
  );
};

const municipalityBoundsIndex = buildMunicipalityBoundsIndex(
  municipalityBoundsIndexData,
);

export const DEFAULT_CENTER: [number, number] = [-15.749997, -47.9499962];
export const MAP_FOCUS_ANIMATION_DURATION = 1200;
export const MAP_OVERLAY_ADJUST_DURATION = 0;
export const MAP_STATE_FOCUS_MAX_ZOOM = 5.5;
export const MAP_MUNICIPALITY_FOCUS_MAX_ZOOM = 14.5;
export const MUNICIPALITY_STATE_FOCUS_DURATION = 350;
export const MUNICIPALITY_FOCUS_DELAY_MS = 1000;
export const MUNICIPALITY_FOCUS_RETRY_INTERVAL_MS = 150;
export const MUNICIPALITY_FOCUS_MAX_RETRIES = 10;

export const geoBrasilSource = geometria as unknown as FeatureCollection<
  Geometry,
  EstadoProperties
>;

export const BRAZIL_RASTER_BOUNDS = bbox(geoBrasilSource) as [
  number,
  number,
  number,
  number,
];

export type MapFitBoundsOptions = NonNullable<
  Parameters<maplibregl.Map["fitBounds"]>[1]
>;

export interface MinimumZoomOptions {
  duration?: number;
  easing?: (progress: number) => number;
}

export const smoothCameraEasing = (progress: number) =>
  1 - Math.pow(1 - progress, 3);

export const enforceMinimumMapZoom = (
  map: maplibregl.Map,
  minZoom: number,
  options: MinimumZoomOptions = {},
) => {
  if (map.getZoom() >= minZoom) return;

  map.easeTo({
    duration: options.duration,
    easing: options.easing,
    zoom: minZoom,
  });
};

export const resolveCurrentBounds = (
  geoBrasil: FeatureCollection<Geometry, EstadoProperties>,
  estadoSelecionado: string,
): LngLatBoundsLike => {
  if (estadoSelecionado === BRAZIL_TERRITORY_CODE) {
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
};

const toLngLatBounds = (
  boundingBox: [number, number, number, number],
): LngLatBoundsLike => {
  const [minLng, minLat, maxLng, maxLat] = boundingBox;
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
};

/**
 * Limites para enquadrar a área de interesse selecionada.
 *
 * Prefere o contorno real quando ele existe (bioma, semiárido, ASD). Para
 * região e estado não há contorno servido pela API, então cai na união dos
 * estados que compõem a área — a mesma lista já usada para decidir quais
 * estados ficam clicáveis. Sem nenhuma restrição de estado a área é nacional,
 * e o enquadramento é o do Brasil.
 *
 * @example resolveSpatialFocusBounds(geoBrasilSource, new Set(["pb", "ce"]), null)
 */
export const resolveSpatialFocusBounds = (
  geoBrasil: FeatureCollection<Geometry, EstadoProperties>,
  allowedStateUfs: Set<string> | null,
  boundaryGeoJson: FeatureCollection<Geometry, GeoJsonProperties> | null,
): LngLatBoundsLike | null => {
  if (boundaryGeoJson?.features.length) {
    return toLngLatBounds(
      bbox(boundaryGeoJson) as [number, number, number, number],
    );
  }

  if (!allowedStateUfs?.size) {
    return toLngLatBounds(bbox(geoBrasil) as [number, number, number, number]);
  }

  // `getAllowedStateUfs` devolve UFs minúsculas; `info.sigla` é maiúscula.
  const normalizedUfs = new Set(
    [...allowedStateUfs].map((uf) => uf.toUpperCase()),
  );
  const features = geoBrasil.features.filter((feature) =>
    normalizedUfs.has(feature.properties?.info.sigla ?? ""),
  );

  if (!features.length) return null;

  return toLngLatBounds(
    bbox({ type: "FeatureCollection", features }) as [
      number,
      number,
      number,
      number,
    ],
  );
};

const getFeatureBounds = (
  feature: MapGeoJSONFeature,
): LngLatBoundsLike | null => {
  if (!feature.geometry) return null;

  const [minLng, minLat, maxLng, maxLat] = bbox({
    type: "Feature",
    geometry: feature.geometry,
    properties: {},
  });

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
};

export const getIndexedMunicipalityBounds = (
  municipalityCode: string,
): LngLatBoundsLike | null => {
  const bounds = municipalityBoundsIndex[municipalityCode];

  if (!bounds) {
    return null;
  }

  const [minLng, minLat, maxLng, maxLat] = bounds;

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
};

export const resolveMunicipalitySelectionBounds = (
  map: maplibregl.Map,
  municipalityCode: string,
) => {
  const indexedBounds = getIndexedMunicipalityBounds(municipalityCode);
  if (indexedBounds) return indexedBounds;

  const features = map.querySourceFeatures(MUNICIPALITY_SOURCE_ID, {
    sourceLayer: MUNICIPALITY_SOURCE_LAYER,
  }) as MapGeoJSONFeature[];

  const feature = features.find((currentFeature) => {
    if (String(currentFeature.id ?? "") === municipalityCode) {
      return true;
    }

    const properties = currentFeature.properties as
      | Record<string, unknown>
      | undefined;
    return properties?.[MUNICIPALITY_ID_PROPERTY] === municipalityCode;
  });

  if (!feature) return null;

  return getFeatureBounds(feature);
};

export const buildCdiGeoJson = (
  dadosCDI?: CDIVectorData,
): FeatureCollection<Geometry, CDIFeatureProperties> => ({
  type: "FeatureCollection",
  features: dadosCDI?.features ?? [],
});

export const isValidLatLngTuple = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === "number" &&
  Number.isFinite(value[0]) &&
  typeof value[1] === "number" &&
  Number.isFinite(value[1]);
