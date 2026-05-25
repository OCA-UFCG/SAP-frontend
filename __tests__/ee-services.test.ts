import { describe, expect, it, vi } from "vitest";

vi.mock("@google/earthengine", () => ({
  default: {},
}));

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(),
}));

import { shouldApplySelfMask } from "@/app/api/ee/services";

describe("Earth Engine self mask selection", () => {
  it("keeps zero-valued pixels visible when the layer scale includes zero", () => {
    expect(
      shouldApplySelfMask({
        imageParams: [
          { color: "#111111", label: "Low", pixelLimit: 1 },
          { color: "#222222", label: "High", pixelLimit: 2 },
        ],
        minScale: 0,
        maxScale: 25,
        mapVisualization: {
          min: 1,
          max: 6,
          palette: ["#111111", "#222222"],
          sourceBand: "Gpp",
          band: "gpp_class",
          thresholds: [7000, 13000],
        },
      }),
    ).toBe(false);
  });

  it("keeps zero-valued class rasters visible when imageParams define class zero", () => {
    expect(
      shouldApplySelfMask({
        imageParams: [
          { color: "#c2c2c4", label: "Sem seca", pixelLimit: 0 },
          { color: "#ffff00", label: "Estágio 1", pixelLimit: 1 },
        ],
        minScale: 0,
        maxScale: 5,
      }),
    ).toBe(false);
  });

  it("keeps self-mask enabled when the configured range does not include zero", () => {
    expect(
      shouldApplySelfMask({
        imageParams: [
          { color: "#ffff00", label: "Árido", pixelLimit: 1 },
          { color: "#ffa500", label: "Semiárido", pixelLimit: 2 },
        ],
        minScale: 2,
        maxScale: 5,
      }),
    ).toBe(true);
  });
});
