"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { IEEInfo, IImageParam } from "@/utils/interfaces";
import type { SpatialSelection } from "@/utils/spatialScope";
import {
  activateEeLayerState,
  activateVectorLayerState,
  clearActiveLayerState,
  createInitialMapLayerState,
  MapLayerState,
  type ReferenceLayerId,
  resetPlatformState as resetPlatformStateValue,
  setActiveLegendValue,
  setActiveYearValue,
  setLayerOpacityValue,
  setSelectedMunicipalityCodeValue,
  setSelectedStateValue,
  setSpatialSelection,
  toggleReferenceOverlayValue,
} from "@/components/MapLayerContext/mapLayerState";
import type { CDIVectorData } from "@/lib/geo";

interface MapLayerActions {
  setActiveLegend: (legend: IImageParam[] | null) => void;
  setSelectedState: (state: string) => void;
  setSelectedMunicipalityCode: (municipalityCode: string | null) => void;
  setActiveYear: (year: string) => void;
  setSpatialSelection: (selection: SpatialSelection) => void;
  activateVectorLayer: (
    layerId: string,
    data: CDIVectorData,
    legend: IImageParam[] | null,
  ) => void;
  activateEeLayer: (data: IEEInfo, legend: IImageParam[] | null) => void;
  clearActiveLayer: () => void;
  resetPlatformState: () => void;
  setLayerOpacity: (opacity: number) => void;
  toggleReferenceOverlay: (layerId: ReferenceLayerId) => void;
}

type MapLayerActiveState = Pick<
  MapLayerState,
  "activeData" | "activeEEData" | "activeLayerId"
>;

type MapLayerViewState = Pick<
  MapLayerState,
  | "activeLegend"
  | "selectedState"
  | "selectedMunicipalityCode"
  | "activeYear"
  | "spatialSelection"
  | "layerOpacity"
  | "referenceOverlays"
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

  const setLayerOpacity = useCallback((opacity: number) => {
    setState((current) => setLayerOpacityValue(current, opacity));
  }, []);

  const setSelectedState = useCallback((selectedState: string) => {
    setState((currentState) =>
      setSelectedStateValue(currentState, selectedState),
    );
  }, []);

  const setSelectedMunicipalityCode = useCallback(
    (selectedMunicipalityCode: string | null) => {
      setState((currentState) =>
        setSelectedMunicipalityCodeValue(
          currentState,
          selectedMunicipalityCode,
        ),
      );
    },
    [],
  );

  const setActiveYear = useCallback((activeYear: string) => {
    setState((currentState) => setActiveYearValue(currentState, activeYear));
  }, []);

  const setSpatialSelectionCallback = useCallback(
    (selection: SpatialSelection) => {
      setState((currentState) => setSpatialSelection(currentState, selection));
    },
    [],
  );

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

  const toggleReferenceOverlay = useCallback((layerId: ReferenceLayerId) => {
    setState((currentState) =>
      toggleReferenceOverlayValue(currentState, layerId),
    );
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
      selectedMunicipalityCode: state.selectedMunicipalityCode,
      activeYear: state.activeYear,
      spatialSelection: state.spatialSelection,
      layerOpacity: state.layerOpacity,
      referenceOverlays: state.referenceOverlays,
    }),
    [
      state.activeLegend,
      state.selectedState,
      state.selectedMunicipalityCode,
      state.activeYear,
      state.spatialSelection,
      state.layerOpacity,
      state.referenceOverlays,
    ],
  );

  const actions = useMemo<MapLayerActions>(
    () => ({
      setActiveLegend,
      setSelectedState,
      setSelectedMunicipalityCode,
      setActiveYear,
      setSpatialSelection: setSpatialSelectionCallback,
      activateVectorLayer,
      activateEeLayer,
      clearActiveLayer,
      resetPlatformState,
      setLayerOpacity,
      toggleReferenceOverlay,
    }),
    [
      setActiveLegend,
      setSelectedState,
      setSelectedMunicipalityCode,
      setActiveYear,
      setSpatialSelectionCallback,
      activateVectorLayer,
      activateEeLayer,
      clearActiveLayer,
      resetPlatformState,
      setLayerOpacity,
      toggleReferenceOverlay,
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
