'use client';

import { MapContainer, TileLayer, GeoJSON, ZoomControl, useMap } from 'react-leaflet';
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
  minZoom?: number; 
  center: [number, number];
  zoom?: number;
  markers?: Array<{ position: [number, number]; label: string }>;
  className?: string;
  showStatesBorder?: boolean;
  dadosCDI?: CDIVectorData;
  estadoSelecionado: string;
  // 1. Add the callback prop
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
    if (bounds) {
      map.fitBounds(bounds, { padding: [20, 20], animate: true });
    }
  }, [bounds, map]);

  return null;
}

const Map = ({
  center = [51.505, -0.09],
  zoom = 13,
  minZoom = 3,
  className = 'h-full w-full',
  dadosCDI,
  showStatesBorder = true,
  estadoSelecionado,
  onStateClick, // 2. Destructure the prop
}: MapProps) => {
  const geoBrasil = geometria as unknown as FeatureCollection<
    Geometry,
    EstadoProperties
  >;

  const currentBounds = useMemo((): LatLngBoundsExpression => {
    if (estadoSelecionado === 'BR') {
      const [minLng, minLat, maxLng, maxLat] = bbox(geoBrasil);
      return [
        [minLat, minLng],
        [maxLat, maxLng],
      ];
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
      '#E4E5E2',
      '#FFCC80',
      '#FB8C00',
      '#BF360C',
      '#A3B18A',
      '#588157',
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
    if(!feature){
      return {}
    }
    if (feature.properties && feature.properties?.info?.sigla.toUpperCase() == estadoSelecionado) {
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
    if (feature.properties && feature.properties?.info?.sigla) {
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
          if(feature.properties?.info?.sigla.toUpperCase() != estadoSelecionado){
            e.target.setStyle({
              weight: 1,
              color: '#3388ff',
              dashArray: '',
              fillOpacity: 0,
            });
          }
          l.closePopup();
        },
        // 3. Add the click listener
        click: () => {
          if (onStateClick) {
            onStateClick(uf);
          }
        }
      });
    }
  };

  return (
    <div className="w-full">
      <MapContainer
        center={center}
        zoom={zoom}
        minZoom={minZoom}
        zoomControl={false}
        scrollWheelZoom={true}
        className={className}
        preferCanvas={true}
        maxBounds={[[-90, -180], [90, 180]]}
        maxBoundsViscosity={1}
      >
        <ZoomControl position="topright" /> // align with Samuel's position
        <ChangeView bounds={currentBounds} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap contributors"
        />
        {dadosCDI && (
          <GeoJSON
            data={dadosCDI as FeatureCollection}
            key={`cdi-layer-${!!dadosCDI}`}
            style={vectorStyle}
          />
        )}
        {showStatesBorder && (
          <GeoJSON
            data={geometria as FeatureCollection}
            onEachFeature={onEachFeature}
            // Note: key should be unique to re-render if geometry changes
            key={`${estadoSelecionado}`}
            style={defaultStyle}
          />
        )}
      </MapContainer>
    </div>
  );
};

export default Map;