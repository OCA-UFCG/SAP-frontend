import { describe, expect, it } from "vitest";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import {
  groupPatchYearsByBaseYear,
  mergeAnalysisYear,
  mergeCompactDataset,
  mergeCompactDatasetYear,
  mergePartialMunicipalImageData,
  type CompactTerritorialAnalysisDatasetPatch,
} from "@/utils/municipalAnalysisMerge";

function buildBaseDataset(): CompactTerritorialAnalysisDataset {
  return {
    schemaVersion: 1,
    type: "territorial-compact",
    defaultYear: "2026-02",
    classes: [
      { id: "a", label: "Classe A", color: "#111111" },
      { id: "b", label: "Classe B", color: "#222222" },
    ],
    locations: {
      br: "Brasil",
      ba: "Bahia",
    },
    templates: {
      state: "Estado {name}",
    },
    ranking: {
      title: "Ranking base",
    },
    mapVisualization: {
      min: 0,
      max: 100,
    },
    years: {
      "2026-02": {
        imageId: "img-2026-02",
        year: "2026-02",
        valuesScale: 10,
        values: {
          br: [400, 600],
          ba: [300, 700],
        },
      },
      "2025": {
        imageId: "img-2025",
        valuesScale: 1,
        values: {
          br: [45, 55],
        },
      },
    },
  };
}

describe("municipalAnalysisMerge", () => {
  it("groups patch years by exact base key before calendar fallback", () => {
    const grouped = groupPatchYearsByBaseYear(
      {
        "2026": {
          imageId: "img-2026",
          values: {},
        },
        "2026-02": {
          imageId: "img-2026-02",
          values: {},
        },
      },
      {
        "2026": { values: { ba: [10, 90] } },
        "2026-03": { values: { pe: [20, 80] } },
      },
    );

    expect(grouped.get("2026")).toEqual([{ values: { ba: [10, 90] } }]);
    expect(grouped.has("2026-02")).toBe(false);
  });

  it("maps calendar-year patches to the only matching base year", () => {
    const grouped = groupPatchYearsByBaseYear(
      {
        "2026-02": {
          imageId: "img-2026-02",
          values: {},
        },
      },
      {
        "2026": { values: { ba: [10, 90] } },
      },
    );

    expect(grouped.get("2026-02")).toEqual([{ values: { ba: [10, 90] } }]);
  });

  it("normalizes patch values to the base scale when merging a year", () => {
    expect(
      mergeAnalysisYear(
        {
          imageId: "img-2026",
          valuesScale: 10,
          values: { br: [400, 600] },
        },
        {
          valuesScale: 1,
          values: { "2914802": [80, 20] },
        },
      ),
    ).toEqual({
      imageId: "img-2026",
      valuesScale: 10,
      values: {
        br: [400, 600],
        "2914802": [800, 200],
      },
    });
  });

  it("merges compact dataset metadata and only keeps base years", () => {
    const merged = mergeCompactDataset(buildBaseDataset(), {
      locations: {
        "2914802": "Itabuna - BA",
      },
      templates: {
        municipality: "Municipio {name}",
      },
      ranking: {
        totalLabel: "municipios",
      },
      mapVisualization: {
        min: -1,
      },
      years: {
        "2026": {
          valuesScale: 1,
          values: {
            "2914802": [80, 20],
          },
        },
        "2024": {
          valuesScale: 1,
          values: {
            "2900000": [10, 90],
          },
        },
      },
    });

    expect(merged.locations?.["2914802"]).toBe("Itabuna - BA");
    expect(merged.templates).toEqual({
      state: "Estado {name}",
      municipality: "Municipio {name}",
    });
    expect(merged.ranking).toEqual({
      title: "Ranking base",
      totalLabel: "municipios",
    });
    expect(merged.mapVisualization).toEqual({ min: 0, max: 100 });
    expect(merged.years["2026-02"]?.values["2914802"]).toEqual([800, 200]);
    expect(merged.years["2024"]).toBeUndefined();
  });

  it("merges only the requested year for route payloads", () => {
    const patches: CompactTerritorialAnalysisDatasetPatch[] = [
      {
        years: {
          "2026": {
            valuesScale: 1,
            values: {
              "2914802": [80, 20],
            },
          },
          "2025": {
            valuesScale: 1,
            values: {
              "2914802": [70, 30],
            },
          },
        },
      },
    ];

    const merged = mergeCompactDatasetYear(
      buildBaseDataset(),
      patches,
      "2026-02",
    );

    expect(Object.keys(merged.years)).toEqual(["2026-02"]);
    expect(merged.years["2026-02"]?.values["2914802"]).toEqual([800, 200]);
  });

  it("uses the same compact merge for client-side partial payloads", () => {
    const merged = mergePartialMunicipalImageData(buildBaseDataset(), {
      years: {
        "2026": {
          imageId: "ignored-by-merge",
          valuesScale: 1,
          values: {
            "2914802": [80, 20],
          },
        },
      },
    });

    expect(
      merged && "years" in merged ? merged.years["2026-02"] : null,
    ).toEqual(
      expect.objectContaining({
        imageId: "img-2026-02",
        values: expect.objectContaining({
          "2914802": [800, 200],
        }),
      }),
    );
  });

  it("keeps the compact base dataset when a client-side partial payload is invalid", () => {
    const base = buildBaseDataset();
    const merged = mergePartialMunicipalImageData(base, {
      type: "unexpected",
      years: "not-a-year-map",
      classes: "not-a-class-list",
      locations: [],
      templates: [],
      ranking: [],
      mapVisualization: [],
    });

    expect(merged).toBe(base);
    expect(
      merged && "years" in merged ? merged.years["2026-02"] : null,
    ).toEqual(
      expect.objectContaining({
        values: expect.objectContaining({
          br: [400, 600],
        }),
      }),
    );
  });
});
