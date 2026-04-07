"use client";
import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import MapComponent from "../Map/MapComponent";
import { useState } from "react";
import { FeatureCollection, Geometry } from "geojson";
import { maps_legends, statesObj } from "@/utils/constants";
import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";

export interface CDIFeatureProperties {
  classe_cdi: number;
  first: number;
  [key: string]: unknown;
}
export type CDIVectorData = FeatureCollection<Geometry, CDIFeatureProperties>;

/**
 * PlatformMap
 *
 * Placeholder for the real map implementation.
 *
 * In the final implementation this component will:
 * - Render the base map (Leaflet/Mapbox/etc.)
 * - Render thematic layers (e.g., drought/CDI polygons)
 * - Emit selection events (e.g., UF click)
 */
export function PlatformMap() {
  const { activeData, selectedState, setSelectedState } = useMapLayer();

  const handleSearch = (value: string) => {
    const searchLower = value.toLowerCase().trim();
    if (statesObj[searchLower as keyof typeof statesObj]) {
      setSelectedState(searchLower);
      return;
    }
    const foundUF = Object.entries(statesObj).find(
      ([_, name]) => name.toLowerCase() === searchLower,
    );
    if (foundUF) {
      setSelectedState(foundUF[0]);
    } else {
      setSelectedState("br");
    }
  };


  return (
    <div className="absolute inset-0 [&_.leaflet-top.leaflet-left]:left-auto [&_.leaflet-top.leaflet-left]:right-4">
      <div className="relative flex w-full h-full z-10">
        <MapComponent
          minZoom={3}
          center={[-15.749997, -47.9499962]}
          zoom={4}
          showStatesBorder={!!activeData}
          dadosCDI={activeData ?? undefined}
          estadoSelecionado={selectedState.toUpperCase()}
          className="w-full h-full"
          onStateClick={(uf) => setSelectedState(uf.toLowerCase())}
        />
      </div>

      {/* Caption/legend overlay (bottom-right in the Figma) */}
      
      {activeData && <PlatformMapCaption legend={maps_legends.cdi}/>}
      
    </div>
  );
}
