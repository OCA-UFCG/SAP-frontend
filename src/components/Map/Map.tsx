'use client';

import { MapContainer, TileLayer, Popup, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-defaulticon-compatibility/dist/leaflet-defaulticon-compatibility.css';
import 'leaflet-defaulticon-compatibility';
interface MapProps {
  center: [number, number];
  zoom?: number;
  markers?: Array<{ position: [number, number]; label: string }>;
  className?: string;
}

const Map = ({center=[51.505, -0.09], zoom=13, className='h-full w-full'} : (MapProps)) => {
  return (
    <>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={false}
        className={className}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        />
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
