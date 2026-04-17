"use client";
import { createContext, useContext, useState, useEffect } from "react";
import { CDIVectorData } from "@/components/PlatformMap/PlatformMap";
import { IEEInfo } from "@/utils/interfaces";

interface MapLayerContextValue {
  activeData: CDIVectorData | null;
  setActiveData: (data: CDIVectorData | null) => void;
  activeEEData: IEEInfo | null;
  setActiveEEData: (data: IEEInfo | null) => void;
  selectedState: string;
  setSelectedState: (state: string) => void;
  activeLayerId: string | null;
  setActiveLayerId: (id: string | null) => void;
  activeYear: string;
  setActiveYear: (year: string) => void;
}

const MapLayerContext = createContext<MapLayerContextValue | null>(null);

export function MapLayerProvider({ children }: { children: React.ReactNode }) {
  const [activeData, setActiveData] = useState<CDIVectorData | null>(null);
  const [activeEEData, setActiveEEData] = useState<IEEInfo | null>(null);
  const [selectedState, setSelectedState] = useState("br");
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [activeYear, setActiveYear] = useState<string>("general");

  useEffect(() => {
    if (activeEEData) {
      const years = Object.keys(activeEEData.imageData || {});
      if (years.length > 0) {
        const defaultYear = years.includes("general") ? "general" : years[0];
        setActiveYear(defaultYear);
      }
    }
  }, [activeEEData]);

  return (
    <MapLayerContext.Provider value={{
      activeData, setActiveData,
      activeEEData, setActiveEEData,
      selectedState, setSelectedState,
      activeLayerId, setActiveLayerId,
      activeYear, setActiveYear,
    }}>
      {children}
    </MapLayerContext.Provider>
  );
}

export function useMapLayer() {
  const ctx = useContext(MapLayerContext);
  if (!ctx) throw new Error("useMapLayer must be used inside MapLayerProvider");

  return ctx;
}