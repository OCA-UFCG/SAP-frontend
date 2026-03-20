"use client";

import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import MapComponent from "../Map/MapComponent";import { useState, useMemo } from "react";
import { FeatureCollection, Geometry } from "geojson";

import geodata from "../../data/CDI_Janeiro_2024_Vetores.json";
import droughtData from "../../../public/dados-seca.json";
import SearchBar from "../SearchBar/SearchBar";
import { AlertTiers } from "../AlertTiers/AlertTiers";
import { statesObj } from "@/utils/constants";

export interface CDIFeatureProperties {
  classe_cdi: number;
  first: number;
  [key: string]: unknown;
}

export type CDIVectorData = FeatureCollection<Geometry, CDIFeatureProperties>;

const TIER_CONFIG = {
  "sem-seca": { label: "Sem seca", color: "#E4E5E2" },
  observacao: { label: "Observação", color: "#FFCC80" },
  atencao: { label: "Atenção", color: "#FB8C00" },
  alerta: { label: "Seca severa", color: "#BF360C" },
  "recuperacao-total": { label: "Recuperação Total", color: "#A3B18A" },
  "recuperacao-parcial": { label: "Recuperação Parcial", color: "#588157" },
};

export function PlatformMap() {
  const [selectedState, setSelectedState] = useState("br");

  /**
   * 3. Search Mapping Logic
   * Maps full names (e.g., "acre") or abbreviations ("AC") to the JSON keys.
   */
  const handleSearch = (value: string) => {
    const searchLower = value.toLowerCase().trim();

    // Check if input is a UF (key in statesObj)
    if (statesObj[searchLower as keyof typeof statesObj]) {
      setSelectedState(searchLower);
      return;
    }

    // Check if input is a Full Name (value in statesObj)
    const foundUF = Object.entries(statesObj).find(
      ([_, name]) => name.toLowerCase() === searchLower,
    );

    if (foundUF) {
      setSelectedState(foundUF[0]);
    } else {
      // If not found, you can default to Brazil or keep current
      setSelectedState("br");
    }
  };

  /**
   * 1 & 2. Data Transformation & Dynamic Badge Logic
   * Calculates percentages to 1 decimal place and finds the dominant status.
   */
  const { statusItems, highestStatus, highestStatusColor, currentState } =
    useMemo(() => {
      const stateData =
        droughtData[selectedState as keyof typeof droughtData] ||
        droughtData.br;

      let maxVal = -1;
      let maxKey = "sem-seca";

      const items = Object.entries(stateData.status).map(([key, value]) => {
        const percentage = (value as number) * 100;

        if (percentage > maxVal) {
          maxVal = percentage;
          maxKey = key;
        }

        return {
          id: key,
          // 1. One decimal place formatting
          value: Number(percentage.toFixed(1)),
          label: TIER_CONFIG[key as keyof typeof TIER_CONFIG].label,
          color: TIER_CONFIG[key as keyof typeof TIER_CONFIG].color,
        };
      });

      const dominantConfig = TIER_CONFIG[maxKey as keyof typeof TIER_CONFIG];

      return {
        statusItems: items,
        highestStatus: dominantConfig.label,
        highestStatusColor: dominantConfig.color,
        currentState: stateData,
      };
    }, [selectedState]);

  const cdiData = geodata as unknown as CDIVectorData;

  // Helper to determine text color for the checkmark icon based on background brightness
  const isLightColor = ["#E4E5E2", "#FFCC80"].includes(highestStatusColor);

  return (    
  <div className="absolute inset-0 [&_.leaflet-top.leaflet-left]:left-auto [&_.leaflet-top.leaflet-left]:right-4">
      {/* Map canvas placeholder */}
    <div className="relative flex w-full h-full z-10">
      <MapComponent
        minZoom={3} 
        center={[-15.749997, -47.9499962]}
        zoom={4}
        dadosCDI={cdiData}
        estadoSelecionado={selectedState.toUpperCase()}
        className="w-full h-full"
        onStateClick={handleSearch}
      />
    </div>

      
      <PlatformMapCaption />
    </div>
  );
}
