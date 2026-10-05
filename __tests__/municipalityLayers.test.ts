import { describe, expect, it, vi } from "vitest";
import {
  buildMunicipalityLabel,
  ensureMunicipalityLayers,
  MUNICIPALITY_BORDER_MIN_ZOOM,
  MUNICIPALITY_BORDER_LAYER_ID,
  MUNICIPALITY_HOVER_LAYER_ID,
  MUNICIPALITY_SELECTED_BORDER_MIN_ZOOM,
  MUNICIPALITY_SOURCE_ID,
} from "@/components/Map/municipalityLayers";

describe("municipalityLayers", () => {
  it("keeps the selected border visible below the municipality detail zoom", () => {
    expect(MUNICIPALITY_SELECTED_BORDER_MIN_ZOOM).toBeLessThan(
      MUNICIPALITY_BORDER_MIN_ZOOM,
    );
  });

  it("builds a municipality label with state code", () => {
    expect(
      buildMunicipalityLabel({
        properties: { NM_MUN: "Campina Grande", SIGLA_UF: "PB" },
      } as Parameters<typeof buildMunicipalityLabel>[0]),
    ).toBe("Campina Grande (PB)");
  });

  it("returns null when the municipality name is missing", () => {
    expect(
      buildMunicipalityLabel({
        properties: { SIGLA_UF: "PB" },
      } as Parameters<typeof buildMunicipalityLabel>[0]),
    ).toBeNull();
  });

  it("marks hover and selection with a black outline and no fill", () => {
    const addLayer = vi.fn();
    const map = {
      addLayer,
      addSource: vi.fn(),
      getLayer: vi.fn(() => undefined),
      getSource: vi.fn(() => undefined),
    };

    ensureMunicipalityLayers(
      map as unknown as Parameters<typeof ensureMunicipalityLayers>[0],
      "state-borders",
    );

    expect(map.addSource).toHaveBeenCalledWith(
      MUNICIPALITY_SOURCE_ID,
      expect.objectContaining({
        promoteId: expect.objectContaining({
          brazilcities: "CD_MUN",
        }),
      }),
    );

    const highlighted = [
      "any",
      ["boolean", ["feature-state", "hover"], false],
      ["boolean", ["feature-state", "selected"], false],
    ];

    expect(addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MUNICIPALITY_BORDER_LAYER_ID,
        minzoom: MUNICIPALITY_SELECTED_BORDER_MIN_ZOOM,
        paint: expect.objectContaining({
          "line-color": ["case", highlighted, "#000000", "#6B7280"],
          "line-opacity": [
            "step",
            ["zoom"],
            ["case", highlighted, 0.95, 0],
            MUNICIPALITY_BORDER_MIN_ZOOM,
            ["case", highlighted, 0.95, 0.25],
          ],
        }),
      }),
      "state-borders",
    );
  });

  // Regressão: o véu escuro do hover/seleção se somava à cor do índice e fazia
  // o município parecer de outra faixa da legenda.
  it("never paints a fill over the hovered or selected municipality", () => {
    const addLayer = vi.fn();
    const map = {
      addLayer,
      addSource: vi.fn(),
      getLayer: vi.fn(() => undefined),
      getSource: vi.fn(() => undefined),
    };

    ensureMunicipalityLayers(
      map as unknown as Parameters<typeof ensureMunicipalityLayers>[0],
      "state-borders",
    );

    expect(addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MUNICIPALITY_HOVER_LAYER_ID,
        type: "fill",
        paint: expect.objectContaining({ "fill-opacity": 0 }),
      }),
      "state-borders",
    );
  });
});
