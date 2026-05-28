import { describe, expect, it, vi } from "vitest";
import {
  buildMunicipalityLabel,
  ensureMunicipalityLayers,
  MUNICIPALITY_BORDER_MIN_ZOOM,
  MUNICIPALITY_BORDER_LAYER_ID,
  MUNICIPALITY_SELECTED_BORDER_MIN_ZOOM,
  MUNICIPALITY_SOURCE_ID,
} from "@/components/Map/municipalityLayers";

describe("municipalityLayers", () => {
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

  it("uses a black outline for the selected municipality", () => {
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
    expect(addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MUNICIPALITY_BORDER_LAYER_ID,
        minzoom: MUNICIPALITY_SELECTED_BORDER_MIN_ZOOM,
        paint: expect.objectContaining({
          "line-color": [
            "case",
            ["boolean", ["feature-state", "selected"], false],
            "#000000",
            "#6B7280",
          ],
          "line-opacity": [
            "step",
            ["zoom"],
            [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              0.95,
              0,
            ],
            MUNICIPALITY_BORDER_MIN_ZOOM,
            [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              0.95,
              0.25,
            ],
          ],
        }),
      }),
      "state-borders",
    );
  });
});
