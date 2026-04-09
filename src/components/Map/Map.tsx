'use client';

import bbox from '@turf/bbox';
import { Feature, FeatureCollection, Geometry } from 'geojson';
import maplibregl, {
  ExpressionSpecification,
  GeoJSONSource,
  LngLatBoundsLike,
  MapGeoJSONFeature,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useEffect, useMemo, useRef } from 'react';
import geometria from '../../data/geometria.json';
import { CDIFeatureProperties, CDIVectorData } from '../MapSection/MapSection';

interface MapProps {
  minZoom?: number;
  center: [number, number];
  zoom?: number;
  markers?: Array<{ position: [number, number]; label: string }>;
  className?: string;
  showStatesBorder?: boolean;
  dadosCDI?: CDIVectorData;
  estadoSelecionado: string;
  onStateClick?: (uf: string) => void;
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
type SelectedStateProperties = EstadoProperties & {
  isSelected: boolean;
  stateName: string;
  stateUf: string;
};
type MyFeature = Feature<Geometry, SelectedStateProperties>;

const MAP_SOURCE_ID = 'osm-base';
const STATES_SOURCE_ID = 'brazil-states';
const CDI_SOURCE_ID = 'cdi-data';
const STATES_FILL_LAYER_ID = 'state-fills';
const STATES_BORDER_LAYER_ID = 'state-borders';
const CDI_LAYER_ID = 'cdi-layer';

const CDI_FILL_EXPRESSION: ExpressionSpecification = [
  'match',
  ['to-number', ['get', 'classe_cdi']],
  0,
  '#E4E5E2',
  1,
  '#FFCC80',
  2,
  '#FB8C00',
  3,
  '#BF360C',
  4,
  '#A3B18A',
  5,
  '#588157',
  'transparent',
];

const DEFAULT_CENTER: [number, number] = [-15.749997, -47.9499962];
const MAP_FIT_BOUNDS_PADDING = 20;
const MAP_FOCUS_ANIMATION_DURATION = 1200;

const smoothCameraEasing = (progress: number) =>
  1 - Math.pow(1 - progress, 3);

const BASE_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {
    [MAP_SOURCE_ID]: {
      type: 'raster',
      tiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '&copy; OpenStreetMap contributors',
    },
  },
  layers: [
    {
      id: MAP_SOURCE_ID,
      type: 'raster',
      source: MAP_SOURCE_ID,
    },
  ],
};

const toSelectedStatesGeoJson = (
  geoBrasil: FeatureCollection<Geometry, EstadoProperties>,
  estadoSelecionado: string,
): FeatureCollection<
  Geometry,
  SelectedStateProperties
> => ({
  ...geoBrasil,
  features: geoBrasil.features.map((feature) => ({
    ...feature,
    properties: {
      ...feature.properties,
      stateName: feature.properties?.info?.nome ?? '',
      stateUf: feature.properties?.info?.sigla ?? '',
      isSelected:
        feature.properties?.info?.sigla?.toUpperCase() === estadoSelecionado,
    },
  })),
});

const buildCdiGeoJson = (
  dadosCDI?: CDIVectorData,
): FeatureCollection<Geometry, CDIFeatureProperties> => ({
  type: 'FeatureCollection',
  features: dadosCDI?.features ?? [],
});

const isValidLatLngTuple = (
  value: unknown,
): value is [number, number] =>
  Array.isArray(value) &&
  value.length >= 2 &&
  typeof value[0] === 'number' &&
  Number.isFinite(value[0]) &&
  typeof value[1] === 'number' &&
  Number.isFinite(value[1]);

const ensureMapLayers = (
  map: maplibregl.Map,
  showStatesBorder: boolean,
  hasCdiData: boolean,
) => {
  if (!map.getSource(CDI_SOURCE_ID)) {
    map.addSource(CDI_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    });
  }

  if (!map.getLayer(CDI_LAYER_ID)) {
    map.addLayer({
      id: CDI_LAYER_ID,
      type: 'fill',
      source: CDI_SOURCE_ID,
      paint: {
        'fill-color': CDI_FILL_EXPRESSION,
        'fill-opacity': 1,
      },
      layout: {
        visibility: hasCdiData ? 'visible' : 'none',
      },
    });
  }

  if (!map.getSource(STATES_SOURCE_ID)) {
    map.addSource(STATES_SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
      promoteId: 'codarea',
    });
  }

  if (!map.getLayer(STATES_FILL_LAYER_ID)) {
    map.addLayer({
      id: STATES_FILL_LAYER_ID,
      type: 'fill',
      source: STATES_SOURCE_ID,
      paint: {
        'fill-color': '#000000',
        'fill-opacity': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          0.1,
          ['boolean', ['get', 'isSelected'], false],
          0.1,
          0,
        ],
      },
      layout: {
        visibility: showStatesBorder ? 'visible' : 'none',
      },
    });
  }

  if (!map.getLayer(STATES_BORDER_LAYER_ID)) {
    map.addLayer({
      id: STATES_BORDER_LAYER_ID,
      type: 'line',
      source: STATES_SOURCE_ID,
      paint: {
        'line-color': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          '#000000',
          ['boolean', ['get', 'isSelected'], false],
          '#000000',
          '#3388ff',
        ],
        'line-width': [
          'case',
          ['boolean', ['feature-state', 'hover'], false],
          4,
          ['boolean', ['get', 'isSelected'], false],
          4,
          1,
        ],
        'line-opacity': 0.65,
      },
      layout: {
        visibility: showStatesBorder ? 'visible' : 'none',
      },
    });
  }
};

const Map = ({
  center = [51.505, -0.09],
  zoom = 13,
  minZoom = 3,
  markers = [],
  className = 'h-full w-full',
  dadosCDI,
  showStatesBorder = true,
  estadoSelecionado,
  onStateClick,
}: MapProps) => {
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
  const hoveredStateIdRef = useRef<string | number | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const selectedStateRef = useRef(estadoSelecionado);
  const onStateClickRef = useRef(onStateClick);
  const normalizedCenter = isValidLatLngTuple(center) ? center : DEFAULT_CENTER;

  const currentBounds = useMemo((): LngLatBoundsLike => {
    if (estadoSelecionado === 'BR') {
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

  const statesGeoJson = useMemo(
    () => toSelectedStatesGeoJson(geoBrasil, estadoSelecionado),
    [estadoSelecionado, geoBrasil],
  );

  const cdiGeoJson = useMemo(() => buildCdiGeoJson(dadosCDI), [dadosCDI]);

  useEffect(() => {
    selectedStateRef.current = estadoSelecionado;
    onStateClickRef.current = onStateClick;
  }, [estadoSelecionado, onStateClick]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const popup = popupRef.current;
    const initialCenter: [number, number] = [
      normalizedCenter[1],
      normalizedCenter[0],
    ];
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: BASE_STYLE,
      zoom,
      minZoom,
      scrollZoom: true,
      maxPitch: 0,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.jumpTo({ center: initialCenter, zoom });

    map.on('load', () => {
      ensureMapLayers(map, showStatesBorder, Boolean(dadosCDI));

      const statesSource = map.getSource(STATES_SOURCE_ID) as
        | GeoJSONSource
        | undefined;
      statesSource?.setData(statesGeoJson);

      const cdiSource = map.getSource(CDI_SOURCE_ID) as GeoJSONSource | undefined;
      cdiSource?.setData(cdiGeoJson);

      map.setLayoutProperty(
        STATES_FILL_LAYER_ID,
        'visibility',
        showStatesBorder ? 'visible' : 'none',
      );
      map.setLayoutProperty(
        STATES_BORDER_LAYER_ID,
        'visibility',
        showStatesBorder ? 'visible' : 'none',
      );
      map.setLayoutProperty(
        CDI_LAYER_ID,
        'visibility',
        dadosCDI ? 'visible' : 'none',
      );
      map.fitBounds(currentBounds, {
        padding: MAP_FIT_BOUNDS_PADDING,
        animate: false,
      });

      map.on('mousemove', STATES_FILL_LAYER_ID, (event) => {
        const hoveredFeature = event.features?.[0] as
          | MapGeoJSONFeature
          | undefined;
        const hoveredStateId = hoveredFeature?.id;
        const info = JSON.parse(hoveredFeature?.properties?.info)
        const uf = info?.sigla
        if (hoveredStateIdRef.current && hoveredStateIdRef.current !== hoveredStateId) {
          map.setFeatureState(
            { source: STATES_SOURCE_ID, id: hoveredStateIdRef.current },
            { hover: false },
          );
        }

        if (hoveredStateId !== undefined && hoveredStateId !== null) {
          hoveredStateIdRef.current = hoveredStateId;
          map.setFeatureState(
            { source: STATES_SOURCE_ID, id: hoveredStateId },
            { hover: true },
          );
        }

        map.getCanvas().style.cursor = 'pointer';

        if (uf) {
          popup
            .setLngLat(event.lngLat)
            .setText(uf)
            .addTo(map);
        }
      });

      map.on('mouseleave', STATES_FILL_LAYER_ID, () => {
        if (hoveredStateIdRef.current) {
          map.setFeatureState(
            { source: STATES_SOURCE_ID, id: hoveredStateIdRef.current },
            { hover: false },
          );
        }

        hoveredStateIdRef.current = null;
        map.getCanvas().style.cursor = '';
        popup.remove();
      });

      map.on('click', STATES_FILL_LAYER_ID, (event) => {
        const clickedFeature = event.features?.[0] as MyFeature | undefined;
        const uf = clickedFeature?.properties?.stateUf;

        if (uf) onStateClickRef.current?.(uf);
        
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
    cdiGeoJson,
    currentBounds,
    dadosCDI,
    minZoom,
    normalizedCenter,
    showStatesBorder,
    statesGeoJson,
    zoom,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !map.isStyleLoaded()) {
      return;
    }

    ensureMapLayers(map, showStatesBorder, Boolean(dadosCDI));

    const statesSource = map.getSource(STATES_SOURCE_ID) as GeoJSONSource | undefined;
    statesSource?.setData(statesGeoJson);

    const cdiSource = map.getSource(CDI_SOURCE_ID) as GeoJSONSource | undefined;
    cdiSource?.setData(cdiGeoJson);

    map.setLayoutProperty(
      STATES_FILL_LAYER_ID,
      'visibility',
      showStatesBorder ? 'visible' : 'none',
    );
    map.setLayoutProperty(
      STATES_BORDER_LAYER_ID,
      'visibility',
      showStatesBorder ? 'visible' : 'none',
    );
    map.setLayoutProperty(
      CDI_LAYER_ID,
      'visibility',
      dadosCDI ? 'visible' : 'none',
    );
  }, [cdiGeoJson, dadosCDI, showStatesBorder, statesGeoJson]);

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
      maxZoom: 7,
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
    <div className="w-full">
      <div className={className} ref={mapContainerRef} />
    </div>
  );
};

export default Map;
