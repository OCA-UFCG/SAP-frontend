import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useRef } from "react";
import { isValidLatLngTuple } from "./mapBounds";

interface MapMarkerData {
  position: [number, number];
  label: string;
}

export const useMapMarkers = (
  mapRef: React.RefObject<maplibregl.Map | null>,
  markers: MapMarkerData[],
  mapInstanceVersion: number,
) => {
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
  }, []);

  useEffect(() => clearMarkers, [clearMarkers]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    clearMarkers();
    markersRef.current = markers
      .filter(({ position }) => isValidLatLngTuple(position))
      .map(({ position, label }) =>
        new maplibregl.Marker()
          .setLngLat([position[1], position[0]])
          .setPopup(new maplibregl.Popup({ offset: 12 }).setText(label))
          .addTo(map),
      );
  }, [clearMarkers, mapInstanceVersion, mapRef, markers]);

  return { clearMarkers };
};
