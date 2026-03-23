'use client';

import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import { Layer, LatLngBoundsExpression } from 'leaflet';
import { useMemo, useEffect } from 'react';
import bbox from '@turf/bbox';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import { FeatureCollection, Feature, Geometry } from 'geojson';
import geometria from '../../data/geometria.json';

interface ChangeViewProps {
  bounds: LatLngBoundsExpression;
}

export interface CDIFeatureProperties {
  classe_cdi: number;
  first: number;
  [key: string]: unknown;
}

export type CDIVectorData = FeatureCollection<Geometry, CDIFeatureProperties>;

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

interface EstadoProperties {
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

type MyFeature = Feature<Geometry, FeatureProperties>;

function ChangeView({ bounds }: ChangeViewProps) {
  const map = useMap();

  useEffect(() => {
    map.fitBounds(bounds, { padding: [20, 20], animate: true });
  }, [bounds, map]);

  return null;
}

const Map = ({
  center = [51.505, -0.09],
  zoom = 13,
  minZoom = 3,
  className = 'h-full w-full',
  dadosCDI,
  showStatesBorder,
  estadoSelecionado,
  onStateClick,
}: MapProps) => {
  const geoBrasil = geometria as unknown as FeatureCollection<
    Geometry,
    EstadoProperties
  >;

  const brasilBounds = useMemo((): LatLngBoundsExpression => {
    const [minLng, minLat, maxLng, maxLat] = bbox(geoBrasil);

  // margem extra pra não ficar "preso" demais
  const latPadding = 8;
  const lngPadding = 12;

  return [
    [minLat - latPadding, minLng - lngPadding],
    [maxLat + latPadding, maxLng + lngPadding],
  ];
}, [geoBrasil]);

  const currentBounds = useMemo((): LatLngBoundsExpression => {
    if (estadoSelecionado === 'BR') {
      return brasilBounds;
    }

    const featureEstado = geoBrasil.features.find(
      (f) => f.properties?.info.sigla === estadoSelecionado,
    );

    if (featureEstado) {
      const [minLng, minLat, maxLng, maxLat] = bbox(featureEstado);
      return [
        [minLat, minLng],
        [maxLat, maxLng],
      ];
    }

    return brasilBounds;
  }, [estadoSelecionado, geoBrasil, brasilBounds]);

  const vectorStyle = (
    feature: Feature<Geometry, CDIFeatureProperties> | undefined,
  ) => {
    if (!feature || !feature.properties) {
      return {
        fillColor: 'transparent',
        weight: 0,
        opacity: 0,
      };
    }

    const classe = Number(feature.properties.classe_cdi);

    const colors = [
      '#FFFFFF',
      '#FFFF00',
      '#FFA500',
      '#FF0000',
      '#00FF00',
      '#8B4513',
    ];

    return {
      fillColor: colors[classe] || 'transparent',
      weight: 0.1,
      opacity: 1,
      color: 'white',
      fillOpacity: 1,
    };
  };

  const defaultStyle = (feature: MyFeature | undefined) => {
    if (!feature) return {};

    if (feature.properties?.info?.sigla.toUpperCase() === estadoSelecionado) {
      return {
        color: '#000000',
        weight: 4,
        dashArray: '',
        fillOpacity: 0.1,
      };
    }

    return {
      color: '#3388ff',
      weight: 1,
      opacity: 0.65,
      fillColor: '#000000',
      fillOpacity: 0,
      dashArray: '0',
    };
  };

  const onEachFeature = (feature: MyFeature, layer: Layer) => {
    if (feature.properties?.info?.sigla) {
      const uf = feature.properties.info.sigla;

      layer.bindPopup(uf);
      layer.on({
        mouseover: (e) => {
          const l = e.target;
          e.target.setStyle({
            weight: 4,
            color: '#000000',
            dashArray: '',
            fillOpacity: 0.1,
          });
          l.openPopup();
        },
        mouseout: (e) => {
          const l = e.target;
          if (feature.properties?.info?.sigla.toUpperCase() !== estadoSelecionado) {
            e.target.setStyle({
              weight: 1,
              color: '#3388ff',
              dashArray: '',
              fillOpacity: 0,
            });
          }
          l.closePopup();
        },
        click: () => {
          onStateClick?.(uf);
        },
      });
    }
  };

  return (
    <div className="w-full">
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={minZoom}
        scrollWheelZoom={true}
        className={className}
        preferCanvas={true}
        maxBounds={brasilBounds}
        maxBoundsViscosity={0.35}
      >
        <ChangeView bounds={currentBounds} />

        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="&copy; Esri"
          noWrap={true}
        />

        <GeoJSON
          data={dadosCDI as FeatureCollection}
          key="cdi-layer"
          style={vectorStyle}
        />
      { showStatesBorder && (
        <GeoJSON
          data={geometria as FeatureCollection}
          onEachFeature={onEachFeature}
          key={estadoSelecionado}
          style={defaultStyle}
        />
      )}
      </MapContainer>
    </div>
  );
};

export default Map;