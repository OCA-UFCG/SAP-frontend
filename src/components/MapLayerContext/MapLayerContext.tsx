"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { IEEInfo, IImageParam } from "@/utils/interfaces";
import {
  activateEeLayerState,
  activateVectorLayerState,
  CDIVectorData,
  clearActiveLayerState,
  createInitialMapLayerState,
  MapLayerState,
  resetPlatformState as resetPlatformStateValue,
  setActiveLegendValue,
  setActiveYearValue,
  setSelectedStateValue,
} from "@/components/MapLayerContext/mapLayerState";

interface MapLayerContextValue extends MapLayerState {
  setActiveLegend: (legend: IImageParam[] | null) => void;
  setSelectedState: (state: string) => void;
  setActiveYear: (year: string) => void;
  activateVectorLayer: (
    layerId: string,
    data: CDIVectorData,
    legend: IImageParam[] | null,
  ) => void;
  activateEeLayer: (data: IEEInfo, legend: IImageParam[] | null) => void;
  clearActiveLayer: () => void;
  resetPlatformState: () => void;
}

const MapLayerContext = createContext<MapLayerContextValue | null>(null);

export function MapLayerProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<MapLayerState>(createInitialMapLayerState);

  const setActiveLegend = useCallback((legend: IImageParam[] | null) => {
    setState((currentState) => setActiveLegendValue(currentState, legend));
  }, []);

  const setSelectedState = useCallback((selectedState: string) => {
    setState((currentState) =>
      setSelectedStateValue(currentState, selectedState),
    );
  }, []);

  const setActiveYear = useCallback((activeYear: string) => {
    setState((currentState) => setActiveYearValue(currentState, activeYear));
  }, []);

  const activateVectorLayer = useCallback(
    (layerId: string, data: CDIVectorData, legend: IImageParam[] | null) => {
      setState((currentState) =>
        activateVectorLayerState(currentState, layerId, data, legend),
      );
    },
    [],
  );

  const activateEeLayer = useCallback(
    (data: IEEInfo, legend: IImageParam[] | null) => {
      setState((currentState) =>
        activateEeLayerState(currentState, data, legend),
      );
    },
    [],
  );

  const clearActiveLayer = useCallback(() => {
    setState((currentState) => clearActiveLayerState(currentState));
  }, []);

  const resetPlatformState = useCallback(() => {
    setState((currentState) => resetPlatformStateValue(currentState));
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      setActiveLegend,
      setSelectedState,
      setActiveYear,
      activateVectorLayer,
      activateEeLayer,
      clearActiveLayer,
      resetPlatformState,
    }),
    [
      state,
      setActiveLegend,
      setSelectedState,
      setActiveYear,
      activateVectorLayer,
      activateEeLayer,
      clearActiveLayer,
      resetPlatformState,
    ],
  );

  return (
    <MapLayerContext.Provider value={value}>
      {children}
    </MapLayerContext.Provider>
  );
}

export function useMapLayer() {
  const ctx = useContext(MapLayerContext);
  if (!ctx) throw new Error("useMapLayer must be used inside MapLayerProvider");

  return ctx;
}
