import { describe, expect, it } from "vitest";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import { buildMunicipalReportSnapshot, buildMunicipalReportTimeSeries, resolveMunicipalReportSnapshot } from "@/utils/municipalReport";

const dataset: CompactTerritorialAnalysisDataset = {
  schemaVersion: 1, type: "territorial-compact", defaultYear: "2024",
  classes: [
    { id: "a", label: "Classe A", color: "#111111" },
    { id: "b", label: "Classe B", color: "#222222" },
  ],
  years: {
    "2024-01": { imageId: "monthly", year: "Janeiro de 2024", valuesScale: 10, values: { "5200050": [333, 667] } },
    "2024-04": { imageId: "monthly", year: "Abril de 2024", valuesScale: 10, values: { "5200050": [700, 300] } },
    "2023": { imageId: "annual", valuesScale: 1, values: { "5200050": [50, 50] } },
    "2024": { imageId: "annual", valuesScale: 1, values: {} },
  },
};

describe("municipal report domain", () => {
  it("scales, rounds and selects the dominant class", () => {
    const snapshot = buildMunicipalReportSnapshot(dataset, "5200050", "2024-01");
    expect(snapshot?.distribution.map((item) => item.percentage)).toEqual([33.3, 66.7]);
    expect(snapshot?.dominantClass?.id).toBe("b");
    expect(snapshot?.label).toBe("Janeiro de 2024");
  });

  it("breaks dominance ties by class order and omits missing periods", () => {
    expect(buildMunicipalReportSnapshot(dataset, "5200050", "2023")?.dominantClass?.id).toBe("a");
    expect(buildMunicipalReportSnapshot(dataset, "5200050", "2024")).toBeNull();
    expect(buildMunicipalReportTimeSeries(dataset, "5200050").map((item) => item.period)).toEqual(["2023", "2024-01", "2024-04"]);
  });

  it("resolves annual, previous and future fallback periods", () => {
    const timeSeries = buildMunicipalReportTimeSeries(dataset, "5200050");

    expect(resolveMunicipalReportSnapshot(timeSeries, "2024")?.period).toBe(
      "2024-04",
    );
    expect(resolveMunicipalReportSnapshot(timeSeries, "2022")?.period).toBe("2023");
    expect(resolveMunicipalReportSnapshot(timeSeries, "2024-02")?.period).toBe("2024-01");
  });
});
