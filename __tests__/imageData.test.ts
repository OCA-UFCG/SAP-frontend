import { describe, expect, it } from "vitest";
import {
  getImageDataLegend,
  keepOnlyFutureForecastPeriods,
  resolveImageYearEntry,
} from "@/utils/imageData";
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

  it("keeps only strictly future months for precipitation forecasts", () => {
    const imageData: CompactTerritorialAnalysisDataset = {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2026-10",
      classes: [{ id: "a", label: "Classe A", color: "#111111" }],
      years: {
        "2026-06": { imageId: "img-06", values: {} },
        "2026-07": { imageId: "img-07", values: {} },
        "2026-08": { imageId: "img-08", values: {} },
        "2026-10": { imageId: "img-10", values: {} },
      },
    };

    const filtered = keepOnlyFutureForecastPeriods(
      "prev_anomalia_precipitacao",
      imageData,
      new Date(2026, 6, 24),
    ) as CompactTerritorialAnalysisDataset;

    expect(Object.keys(filtered.years)).toEqual(["2026-08", "2026-10"]);
    expect(filtered.defaultYear).toBe("2026-10");
  });

  it("does not filter periods from other panel layers", () => {
    const imageData: CompactTerritorialAnalysisDataset = {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2026-07",
      classes: [{ id: "a", label: "Classe A", color: "#111111" }],
      years: {
        "2026-06": { imageId: "img-06", values: {} },
        "2026-07": { imageId: "img-07", values: {} },
      },
    };

    expect(
      keepOnlyFutureForecastPeriods(
        "anaseca",
        imageData,
        new Date(2026, 6, 24),
      ),
    ).toBe(imageData);
  });

  it("uses the Brazil calendar month at UTC month boundaries", () => {
    const imageData: CompactTerritorialAnalysisDataset = {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2026-09",
      classes: [{ id: "a", label: "Classe A", color: "#111111" }],
      years: {
        "2026-07": { imageId: "img-07", values: {} },
        "2026-08": { imageId: "img-08", values: {} },
        "2026-09": { imageId: "img-09", values: {} },
      },
    };

    const filtered = keepOnlyFutureForecastPeriods(
      "prev_anomalia_precipitacao",
      imageData,
      new Date("2026-08-01T01:00:00.000Z"),
    ) as CompactTerritorialAnalysisDataset;

    expect(Object.keys(filtered.years)).toEqual(["2026-08", "2026-09"]);
  });
});
