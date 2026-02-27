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
import { CDIVectorData, CDIFeatureProperties } from '../MapSection/MapSection';

interface ChangeViewProps {
  bounds: LatLngBoundsExpression;
}

interface MapProps {
  center: [number, number];
  zoom?: number;
  markers?: Array<{ position: [number, number]; label: string }>;
  className?: string;
  dadosCDI: CDIVectorData; 
  estadoSelecionado: string; 
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
    if (bounds) {
      map.fitBounds(bounds, { padding: [20, 20], animate: true });
    }
  }, [bounds, map]);

  return null;
}

const Map = ({
  center = [51.505, -0.09],
  zoom = 13,
  className = 'h-full w-full',
  dadosCDI,
  estadoSelecionado,
}: MapProps) => {
  const geoBrasil = geometria as unknown as FeatureCollection<
    Geometry,
    EstadoProperties
  >;

  const currentBounds = useMemo((): LatLngBoundsExpression => {
    if (estadoSelecionado === 'Brasil') {
      const [minLng, minLat, maxLng, maxLat] = bbox(geoBrasil);
      return [
        [minLat, minLng],
        [maxLat, maxLng],
      ];
    }

    const featureEstado = geoBrasil.features.find(
      (f) => f.properties?.info.nome === estadoSelecionado,
    );

    if (featureEstado) {
      const [minLng, minLat, maxLng, maxLat] = bbox(featureEstado);
      return [
        [minLat, minLng],
        [maxLat, maxLng],
      ];
    }

    const [minLng, minLat, maxLng, maxLat] = bbox(geoBrasil);
    return [
      [minLat, minLng],
      [maxLat, maxLng],
    ];
  }, [estadoSelecionado]);

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

  const defaultStyle = {
    color: '#3388ff',
    weight: 0.5,
    opacity: 0.65,
    fillColor: '#000000',
    fillOpacity: 0,
    dashArray: '0',
  };

  const onEachFeature = (feature: MyFeature, layer: Layer) => {
    if (feature.properties && feature.properties?.info?.nome) {
      layer.bindPopup(feature.properties.info.nome);
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
          e.target.setStyle({
            weight: 0.5,
            color: '#3388ff',
            dashArray: '',
            fillOpacity: 0,
          });
          l.closePopup();
        },
      });
    }
  };

  return (
    <>
      <div className="w-full ">
        <MapContainer
          center={center}
          zoom={zoom}
          scrollWheelZoom={true}
          className={className}
          preferCanvas={true}
        >
          <ChangeView bounds={currentBounds} />
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community"
          />
          <GeoJSON
            data={dadosCDI as FeatureCollection}
            key={`cdi-layer`}
            style={vectorStyle}
          />

          <GeoJSON
            data={geometria as FeatureCollection}
            onEachFeature={onEachFeature}
            key={`${geometria}`}
            style={defaultStyle}
          />
        </MapContainer>
      </div>
    </>
  );
};

export default Map;
