import { describe, expect, it } from "vitest";
import { getImageDataLegend, resolveImageYearEntry } from "@/utils/imageData";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";

describe("imageData helpers", () => {
  it("uses map visualization legend separately from analysis classes", () => {
    const imageData: CompactTerritorialAnalysisDataset = {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2025",
      classes: [
        {
          id: "populacao-total",
          label: "População total",
          color: "#bd0026",
        },
      ],
      mapVisualization: {
        sourceType: "featureCollection",
        property: "{year}",
        min: 0,
        max: 100,
        palette: ["#ffffcc", "#bd0026"],
        legend: [
          { id: "0-20", label: "0-20", color: "#ffffcc" },
          { id: ">100", label: ">100", color: "#bd0026" },
        ],
      },
      years: {
        "2025": {
          imageId: "projects/example/assets/pob_total",
          year: "2025",
          values: {
            br: [42],
          },
        },
      },
    };

    expect(getImageDataLegend(imageData)).toEqual([
      { color: "#ffffcc", label: "0-20" },
      { color: "#bd0026", label: ">100" },
    ]);
    expect(resolveImageYearEntry(imageData, "2025")).toMatchObject({
      imageParams: [
        { color: "#ffffcc", label: "0-20" },
        { color: "#bd0026", label: ">100" },
      ],
      mapVisualization: {
        property: "2025",
      },
    });
  });
});
