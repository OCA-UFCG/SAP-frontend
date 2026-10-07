import { describe, expect, it } from "vitest";

import {
  activateEeLayerState,
  activateVectorLayerState,
  clearActiveLayerState,
  type CDIVectorData,
  createInitialMapLayerState,
  resetPlatformState,
  toggleReferenceHighlightValue,
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

  describe("destaque de um grupo de territórios", () => {
    it("destacar um grupo desligado também liga o grupo", () => {
      const state = toggleReferenceHighlightValue(
        createInitialMapLayerState(),
        "terras_indigenas",
      );

      expect(state.highlightedReferenceOverlay).toBe("terras_indigenas");
      expect(Array.from(state.referenceOverlays)).toEqual(["terras_indigenas"]);
    });

    it("destacar outro grupo troca o destaque e mantém os dois ligados", () => {
      const first = toggleReferenceHighlightValue(
        createInitialMapLayerState(),
        "quilombolas",
      );
      const second = toggleReferenceHighlightValue(first, "assentamentos");

      expect(second.highlightedReferenceOverlay).toBe("assentamentos");
      expect(Array.from(second.referenceOverlays).sort()).toEqual([
        "assentamentos",
        "quilombolas",
      ]);
    });

    it("desligar o destaque mantém o grupo ligado", () => {
      const highlighted = toggleReferenceHighlightValue(
        createInitialMapLayerState(),
        "quilombolas",
      );
      const off = toggleReferenceHighlightValue(highlighted, "quilombolas");

      expect(off.highlightedReferenceOverlay).toBeNull();
      expect(Array.from(off.referenceOverlays)).toEqual(["quilombolas"]);
    });

    it("desligar o grupo em destaque tira o destaque", () => {
      const highlighted = toggleReferenceHighlightValue(
        createInitialMapLayerState(),
        "unidades_conservacao",
      );
      const off = toggleReferenceOverlayValue(
        highlighted,
        "unidades_conservacao",
      );

      expect(off.highlightedReferenceOverlay).toBeNull();
      expect(off.referenceOverlays.size).toBe(0);
    });

    it("ligar ou desligar outro grupo não mexe no destaque", () => {
      const highlighted = toggleReferenceHighlightValue(
        createInitialMapLayerState(),
        "quilombolas",
      );
      const withOther = toggleReferenceOverlayValue(
        highlighted,
        "assentamentos",
      );
      const withoutOther = toggleReferenceOverlayValue(
        withOther,
        "assentamentos",
      );

      expect(withOther.highlightedReferenceOverlay).toBe("quilombolas");
      expect(withoutOther.highlightedReferenceOverlay).toBe("quilombolas");
    });

    it("resetar o mapa tira o destaque", () => {
      const highlighted = toggleReferenceHighlightValue(
        createInitialMapLayerState(),
        "terras_indigenas",
      );

      expect(resetPlatformState(highlighted).highlightedReferenceOverlay).toBe(
        null,
      );
    });

    it("vale para qualquer estado com os dois campos, como o da AMFE", () => {
      const amfeSelection = {
        referenceOverlays: new Set<"quilombolas">(),
        highlightedReferenceOverlay: null,
      };

      const next = toggleReferenceHighlightValue(amfeSelection, "quilombolas");

      expect(next).toEqual({
        referenceOverlays: new Set(["quilombolas"]),
        highlightedReferenceOverlay: "quilombolas",
      });
    });
  });
});
