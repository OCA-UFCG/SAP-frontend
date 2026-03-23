"use client";
import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import MapComponent from "../Map/MapComponent";
import { useState } from "react";
import { FeatureCollection, Geometry } from "geojson";
import geodata from "../../data/CDI_Janeiro_2024_Vetores.json";
import { statesObj } from "@/utils/constants";

export interface CDIFeatureProperties {
  classe_cdi: number;
  first: number;
  [key: string]: unknown;
}
export type CDIVectorData = FeatureCollection<Geometry, CDIFeatureProperties>;

export function PlatformMap() {
  const [selectedState, setSelectedState] = useState("br");

  const [showCDI, setShowCDI ] = useState(false);

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

  const cdiData = geodata as unknown as CDIVectorData;

  return (
    <div className="absolute inset-0 [&_.leaflet-top.leaflet-left]:left-auto [&_.leaflet-top.leaflet-left]:right-4">
      <div className="relative flex w-full h-full z-10">
        <MapComponent
          minZoom={3}
          center={[-15.749997, -47.9499962]}
          zoom={4}
          showStatesBorder={false}
          dadosCDI={showCDI ? cdiData : undefined}
          estadoSelecionado={selectedState.toUpperCase()}
          className="w-full h-full"
          onStateClick={handleSearch}
        />
      </div>
      <PlatformMapCaption />
    </div>
  );
}