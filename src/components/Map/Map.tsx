'use client';

import { MapContainer, TileLayer, Popup, Marker, GeoJSON } from 'react-leaflet';
import { Layer } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
import {FeatureCollection, Feature, Geometry} from './geometria.json'
import geo from './geometria.json'

interface MapProps {
  center: [number, number];
  zoom?: number;
  markers?: Array<{ position: [number, number]; label: string }>;
  className?: string;
}

interface FeatureProperties {
  codarea: string;
  info?: {
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

const Map = ({center=[51.505, -0.09], zoom=13, className='h-full w-full'} : (MapProps)) => {

    const onEachFeature = (feature: MyFeature, layer: Layer) => {
    if (feature.properties && feature.properties.info.nome) {
      layer.bindPopup(feature.properties.info.nome);
      layer.on({
        mouseover: (e) => {
          e.target.setStyle({
            weight: 5,
            color: '#666',
            dashArray: '',
            fillOpacity: 0.5
          });
        },
        mouseout: (e) => {
         
          e.target.setStyle({
            weight: 3,
            color: '#3388ff',
            dashArray: '3',
            fillOpacity: 0
          });
        }
      });
    }
  };
  return (
    <>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        className={className}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
        <GeoJSON data={geo as FeatureCollection} onEachFeature={onEachFeature}/>
        <Marker position={center}>
          <Popup>
            PopUp. 
          </Popup>
        </Marker>
      </MapContainer>
    </>
  );
};

export default Map;
