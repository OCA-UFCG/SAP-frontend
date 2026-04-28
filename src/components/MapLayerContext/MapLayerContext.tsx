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
  clearActiveLayerState,
  createInitialMapLayerState,
  MapLayerState,
  resetPlatformState as resetPlatformStateValue,
  setActiveLegendValue,
  setActiveYearValue,
  setSelectedStateValue,
} from "@/components/MapLayerContext/mapLayerState";
import type { CDIVectorData } from "@/lib/geo";

interface MapLayerActions {
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

type MapLayerActiveState = Pick<
  MapLayerState,
  "activeData" | "activeEEData" | "activeLayerId"
>;

type MapLayerViewState = Pick<
  MapLayerState,
  "activeLegend" | "selectedState" | "activeYear"
>;

interface MapLayerContextValue
  extends MapLayerActiveState, MapLayerViewState, MapLayerActions {}

const MapLayerActiveStateContext = createContext<MapLayerActiveState | null>(
  null,
);
const MapLayerViewStateContext = createContext<MapLayerViewState | null>(null);
const MapLayerActionsContext = createContext<MapLayerActions | null>(null);

function useRequiredContext<T>(
  context: React.Context<T | null>,
  hookName: string,
): T {
  const value = useContext(context);

  if (!value) {
    throw new Error(`${hookName} must be used inside MapLayerProvider`);
  }

  return value;
}

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

  const activeState = useMemo<MapLayerActiveState>(
    () => ({
      activeData: state.activeData,
      activeEEData: state.activeEEData,
      activeLayerId: state.activeLayerId,
    }),
    [state.activeData, state.activeEEData, state.activeLayerId],
  );

  const viewState = useMemo<MapLayerViewState>(
    () => ({
      activeLegend: state.activeLegend,
      selectedState: state.selectedState,
      activeYear: state.activeYear,
    }),
    [state.activeLegend, state.selectedState, state.activeYear],
  );

  const actions = useMemo<MapLayerActions>(
    () => ({
      setActiveLegend,
      setSelectedState,
      setActiveYear,
      activateVectorLayer,
      activateEeLayer,
      clearActiveLayer,
      resetPlatformState,
    }),
    [
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
    <MapLayerActionsContext.Provider value={actions}>
      <MapLayerActiveStateContext.Provider value={activeState}>
        <MapLayerViewStateContext.Provider value={viewState}>
          {children}
        </MapLayerViewStateContext.Provider>
      </MapLayerActiveStateContext.Provider>
    </MapLayerActionsContext.Provider>
  );
}

export function useMapLayerActions() {
  return useRequiredContext(MapLayerActionsContext, "useMapLayerActions");
}

export function useMapLayerActiveState() {
  return useRequiredContext(
    MapLayerActiveStateContext,
    "useMapLayerActiveState",
  );
}

export function useMapLayerViewState() {
  return useRequiredContext(MapLayerViewStateContext, "useMapLayerViewState");
}

export function useMapLayer() {
  const activeState = useMapLayerActiveState();
  const viewState = useMapLayerViewState();
  const actions = useMapLayerActions();

  return useMemo<MapLayerContextValue>(
    () => ({
      ...activeState,
      ...viewState,
      ...actions,
    }),
    [activeState, viewState, actions],
  );
}
