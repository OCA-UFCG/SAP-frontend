"use client";
import { createContext, useContext, useState } from "react";
import { CDIVectorData } from "@/components/PlatformMap/PlatformMap";
import { IEEInfo, IImageParam } from "@/utils/interfaces";

interface MapLayerContextValue {
  activeData: CDIVectorData | null;
  activeLegend: IImageParam[] | null;
  setActiveLegend: (legend: IImageParam[] | null) => void;
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
  const [activeEEData, _setActiveEEData] = useState<IEEInfo | null>(null);
  const [selectedState, setSelectedState] = useState("br");
  const [activeLayerId, setActiveLayerId] = useState<string | null>(null);
  const [activeLegend, setActiveLegend] = useState<IImageParam[] | null>(null);
  const [activeYear, setActiveYear] = useState<string>("general");

  const setActiveEEData = (data: IEEInfo | null) => {
    _setActiveEEData(data);

    if (!data) {
      setActiveYear("general");
      return;
    }

    const imageData = data.imageData || {};
    const years = Object.keys(imageData);
    if (years.length === 0) {
      setActiveYear("general");
      return;
    }

    const defaultFromFlag = years.find((year) => imageData[year]?.default);
    const defaultYear =
      defaultFromFlag ?? (years.includes("general") ? "general" : years[0]);

    setActiveYear(defaultYear);
  };

  return (
    <MapLayerContext.Provider
      value={{
        activeData,
        activeLegend,
        setActiveLegend,
        setActiveData,
        activeEEData,
        setActiveEEData,
        selectedState,
        setSelectedState,
        activeLayerId,
        setActiveLayerId,
        activeYear,
        setActiveYear,
      }}
    >
      {children}
    </MapLayerContext.Provider>
  );
}

export function useMapLayer() {
  const ctx = useContext(MapLayerContext);
  if (!ctx) throw new Error("useMapLayer must be used inside MapLayerProvider");

  return ctx;
}
