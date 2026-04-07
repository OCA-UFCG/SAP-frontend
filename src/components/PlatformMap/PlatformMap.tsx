"use client";
import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import MapComponent from "../Map/MapComponent";
import { FeatureCollection, Geometry } from "geojson";
import { maps_legends, statesObj } from "@/utils/constants";
import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";
import { resolveStateKeyFromSearch } from "@/utils/functions";

export interface CDIFeatureProperties {
  classe_cdi: number;
  first: number;
  [key: string]: unknown;
}
export type CDIVectorData = FeatureCollection<Geometry, CDIFeatureProperties>;

export function PlatformMap() {
  const { activeData, selectedState, setSelectedState } = useMapLayer();

  const handleSearch = (value: string) => {
  const result = resolveStateKeyFromSearch(value, statesObj);
  setSelectedState(result.key);
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
