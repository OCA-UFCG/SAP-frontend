import { describe, expect, it } from "vitest";

import {
  classifyValueByThresholds,
  resolveMapVisualizationPlan,
} from "@/app/api/ee/mapVisualization";

describe("Earth Engine map visualization planning", () => {
  it("plans threshold classification for continuous rasters before palette rendering", () => {
    const palette = ["#100000", "#200000", "#300000", "#400000"];
    const plan = resolveMapVisualizationPlan(
      {
        min: 1,
        max: 4,
        palette,
        sourceBand: "raw_value",
        band: "classified_value",
        thresholds: [10, 20, 30],
      },
      palette.map((color, index) => ({
        color,
        label: `Class ${index + 1}`,
        pixelLimit: index + 1,
      })),
      0,
      30,
    );

    expect(plan).toEqual({
      sourceBand: "raw_value",
      visParams: { min: 1, max: 4, palette },
      thresholdClassification: {
        outputBand: "classified_value",
        startValue: 1,
        thresholds: [10, 20, 30],
      },
    });

    const rawValueFarAboveVisualMax = 3000;
    expect(rawValueFarAboveVisualMax).toBeGreaterThan(plan.visParams.max);
    expect(
      classifyValueByThresholds(
        rawValueFarAboveVisualMax,
        plan.thresholdClassification?.thresholds ?? [],
        plan.thresholdClassification?.startValue ?? 1,
      ),
    ).toBe(4);
  });

  it("does not create a classification plan for already categorized rasters", () => {
    const plan = resolveMapVisualizationPlan(
      {
        min: 0,
        max: 2,
        palette: ["#000000", "#111111", "#222222"],
        band: "class_code",
      },
      [],
      0,
      2,
    );

    expect(plan).toEqual({
      sourceBand: "class_code",
      visParams: {
        min: 0,
        max: 2,
        palette: ["#000000", "#111111", "#222222"],
      },
    });
  });

  it("keeps feature collection visualization metadata in the resolved plan", () => {
    const plan = resolveMapVisualizationPlan(
      {
        sourceType: "featureCollection",
        property: "2025",
        min: 1,
        max: 5,
        thresholds: [20, 40, 60, 80],
        palette: ["#ffffcc", "#fed976", "#feb24c", "#fd8d3c", "#bd0026"],
        legend: [
          { id: "low", label: "Baixo", color: "#ffffcc" },
          { id: "high", label: "Alto", color: "#bd0026" },
        ],
        outline: { color: "#000000", width: 0.5, opacity: 1 },
      },
      [],
      0,
      100,
    );

    expect(plan).toEqual({
      sourceType: "featureCollection",
      property: "2025",
      sourceBand: undefined,
      outline: { color: "#000000", width: 0.5, opacity: 1 },
      visParams: {
        min: 1,
        max: 5,
        palette: ["#ffffcc", "#fed976", "#feb24c", "#fd8d3c", "#bd0026"],
      },
      thresholdClassification: {
        outputBand: undefined,
        startValue: 1,
        thresholds: [20, 40, 60, 80],
      },
    });

    expect(
      classifyValueByThresholds(
        80.1,
        plan.thresholdClassification?.thresholds ?? [],
        plan.thresholdClassification?.startValue ?? 1,
      ),
    ).toBe(5);
  });
});
