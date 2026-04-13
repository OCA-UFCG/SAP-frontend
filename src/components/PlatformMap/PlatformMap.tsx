"use client";
import { useEffect, useState } from "react";
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
  const { activeData, activeEEData, selectedState, setSelectedState } = useMapLayer();
  const [tileLayerUrl, setTileLayerUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!activeEEData) {
      setTileLayerUrl(undefined);
      return;
    }

    const fetchGeeUrl = async () => {
      try {
        const years = Object.keys(activeEEData.imageData || {});
        const defaultYear = years.includes("general") ? "general" : (years[0] || "general");
        
        const res = await fetch(`/api/ee?name=${activeEEData.id}&year=${defaultYear}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(activeEEData),
        });
        
        const data = await res.json();
        if (data.url) {
          setTileLayerUrl(data.url);
        } else {
          console.error("No GEE tile URL returned");
          setTileLayerUrl(undefined);
        }
      } catch (err) {
        console.error("Error fetching GEE tile layer:", err);
        setTileLayerUrl(undefined);
      }
    };

    fetchGeeUrl();
  }, [activeEEData]);

  const handleSearch = (value: string) => {
    const result = resolveStateKeyFromSearch(value, statesObj);
    setSelectedState(result.key);
  };

  return (
    <div className="absolute inset-0">
      <div className="relative flex w-full h-full z-10">
        <MapComponent
          minZoom={3}
          center={[-15.749997, -47.9499962]}
          zoom={4}
          showStatesBorder={!!activeData}
          dadosCDI={activeData ?? undefined}
          estadoSelecionado={selectedState.toUpperCase()}
          className="w-full h-full"
          onStateClick={handleSearch}
          tileLayerUrl={tileLayerUrl}
        />
      </div>

      {/* Caption/legend overlay (bottom-right in the Figma) */}
      
      {activeData && <PlatformMapCaption legend={maps_legends.cdi}/>}
      
    </div>
  );
}
