"use client";
import { createContext, useContext, useState } from "react";
import { CDIVectorData } from "@/components/PlatformMap/PlatformMap";

interface MapLayerContextValue {
  activeData: CDIVectorData | null;
  setActiveData: (data: CDIVectorData | null) => void;
  selectedState: string;
  setSelectedState: (state: string) => void;
}

const MapLayerContext = createContext<MapLayerContextValue | null>(null);

export function MapLayerProvider({ children }: { children: React.ReactNode }) {
  const [activeData, setActiveData] = useState<CDIVectorData | null>(null);
  const [selectedState, setSelectedState] = useState("br");

  
  return (
    <MapLayerContext.Provider value={{ activeData, setActiveData, selectedState, setSelectedState }}>
      {children}
    </MapLayerContext.Provider>
  );
}

export function useMapLayer() {
  const ctx = useContext(MapLayerContext);
  if (!ctx) throw new Error("useMapLayer must be used inside MapLayerProvider");
  
  return ctx;
}