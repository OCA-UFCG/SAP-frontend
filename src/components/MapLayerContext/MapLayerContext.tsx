"use client";
import { createContext, useContext, useState } from "react";
import { CDIVectorData } from "@/components/PlatformMap/PlatformMap";

interface MapLayerContextValue {
  activeData: CDIVectorData | null;
  setActiveData: (data: CDIVectorData | null) => void;
}

const MapLayerContext = createContext<MapLayerContextValue | null>(null);

export function MapLayerProvider({ children }: { children: React.ReactNode }) {
  const [activeData, setActiveData] = useState<CDIVectorData | null>(null);

  return (
    <MapLayerContext.Provider value={{ activeData, setActiveData }}>
      {children}
    </MapLayerContext.Provider>
  );
}

export function useMapLayer() {
  const ctx = useContext(MapLayerContext);
  if (!ctx) throw new Error("useMapLayer must be used inside MapLayerProvider");
  return ctx;
}