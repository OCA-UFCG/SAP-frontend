import { describe, expect, it } from "vitest";

import {
  activateEeLayerState,
  activateVectorLayerState,
  clearActiveLayerState,
  type CDIVectorData,
  createInitialMapLayerState,
  resetPlatformState,
} from "@/components/MapLayerContext/mapLayerState";
import type { IEEInfo, IImageParam } from "@/utils/interfaces";

const legend: IImageParam[] = [
  {
    color: "#989F43",
    label: "Legenda",
  },
];

const eeLayer = {
  id: "ee-layer",
  name: "Layer EE",
  description: "Layer EE",
  measurementUnit: "%",
  poster: "/poster.png",
  imageData: {
    2024: {
      default: true,
      imageId: "projects/example/image",
      imageParams: legend,
    },
  },
  type: "raster",
} as IEEInfo;

describe("mapLayerState", () => {
  it("activates an EE layer with its default year", () => {
    const state = activateEeLayerState(
      createInitialMapLayerState(),
      eeLayer,
      legend,
    );

    expect(state.activeEEData?.id).toBe("ee-layer");
    expect(state.activeLayerId).toBe("ee-layer");
    expect(state.activeLegend).toEqual(legend);
    expect(state.activeYear).toBe("2024");
  });

  it("activates a vector layer and clears EE state", () => {
    const stateWithEeLayer = activateEeLayerState(
      createInitialMapLayerState(),
      eeLayer,
      legend,
    );
    const vectorLayer: CDIVectorData = {
      type: "FeatureCollection",
      features: [],
    };

    const state = activateVectorLayerState(
      stateWithEeLayer,
      "CDI",
      vectorLayer,
      legend,
    );

    expect(state.activeData).toEqual(vectorLayer);
    expect(state.activeEEData).toBeNull();
    expect(state.activeLayerId).toBe("CDI");
    expect(state.activeYear).toBe("general");
  });

  it("clears the active layer without discarding the selected territory", () => {
    const state = clearActiveLayerState({
      ...createInitialMapLayerState(),
      activeData: {
        type: "FeatureCollection",
        features: [],
      } as CDIVectorData,
      activeLegend: legend,
      activeLayerId: "CDI",
      selectedState: "mg",
      activeYear: "2024",
    });

    expect(state.activeData).toBeNull();
    expect(state.activeLegend).toBeNull();
    expect(state.activeLayerId).toBeNull();
    expect(state.activeYear).toBe("general");
    expect(state.selectedState).toBe("mg");
  });

  it("fully resets the platform state when leaving analysis", () => {
    const state = resetPlatformState({
      ...createInitialMapLayerState(),
      activeEEData: eeLayer,
      activeLegend: legend,
      activeLayerId: "ee-layer",
      selectedState: "ce",
      activeYear: "2024",
    });

    expect(state.activeEEData).toBeNull();
    expect(state.activeLegend).toBeNull();
    expect(state.activeLayerId).toBeNull();
    expect(state.selectedState).toBe("br");
    expect(state.activeYear).toBe("general");
  });
});
