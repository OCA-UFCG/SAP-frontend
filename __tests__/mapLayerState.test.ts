import { describe, expect, it } from "vitest";

import {
  activateEeLayerState,
  activateVectorLayerState,
  clearActiveLayerState,
  type CDIVectorData,
  createInitialMapLayerState,
  resetPlatformState,
  toggleReferenceOverlayValue,
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
      selectedMunicipalityCode: "3106200",
      activeYear: "2024",
    });

    expect(state.activeData).toBeNull();
    expect(state.activeLegend).toBeNull();
    expect(state.activeLayerId).toBeNull();
    expect(state.activeYear).toBe("general");
    expect(state.selectedState).toBe("mg");
    expect(state.selectedMunicipalityCode).toBe("3106200");
  });

  it("fully resets the platform state when leaving analysis", () => {
    const state = resetPlatformState({
      ...createInitialMapLayerState(),
      activeEEData: eeLayer,
      activeLegend: legend,
      activeLayerId: "ee-layer",
      selectedState: "ce",
      selectedMunicipalityCode: "2304400",
      activeYear: "2024",
      spatialSelection: {
        spatialArea: "region",
        spatialValue: "Nordeste",
      },
    });

    expect(state.activeEEData).toBeNull();
    expect(state.activeLegend).toBeNull();
    expect(state.activeLayerId).toBeNull();
    expect(state.selectedState).toBe("br");
    expect(state.selectedMunicipalityCode).toBeNull();
    expect(state.activeYear).toBe("general");
    expect(state.spatialSelection).toEqual({
      spatialArea: "national",
      spatialValue: "brasil",
    });
  });

  it("toggles a reference overlay on and off without touching the others", () => {
    const withQuilombolas = toggleReferenceOverlayValue(
      createInitialMapLayerState(),
      "quilombolas",
    );
    const withBoth = toggleReferenceOverlayValue(
      withQuilombolas,
      "terras_indigenas",
    );
    const withoutQuilombolas = toggleReferenceOverlayValue(
      withBoth,
      "quilombolas",
    );

    expect(Array.from(withBoth.referenceOverlays).sort()).toEqual([
      "quilombolas",
      "terras_indigenas",
    ]);
    expect(Array.from(withoutQuilombolas.referenceOverlays)).toEqual([
      "terras_indigenas",
    ]);
  });

  it("keeps the previous reference overlay set untouched when toggling", () => {
    const initial = createInitialMapLayerState();
    const next = toggleReferenceOverlayValue(initial, "assentamentos");

    expect(initial.referenceOverlays.size).toBe(0);
    expect(next.referenceOverlays).not.toBe(initial.referenceOverlays);
  });

  it("clears the reference overlays when the platform state is reset", () => {
    const state = toggleReferenceOverlayValue(
      createInitialMapLayerState(),
      "unidades_conservacao",
    );

    expect(resetPlatformState(state).referenceOverlays.size).toBe(0);
  });
});
