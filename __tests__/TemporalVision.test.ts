import { describe, expect, it } from "vitest";
import { buildSeriesData } from "@/components/analysis/TemporalVision";
import type { CompactAnalysisYearData } from "@/utils/analysis";

describe("buildSeriesData", () => {
  it("does not replace missing municipal values with Brazil totals", () => {
    const years: Array<[string, CompactAnalysisYearData]> = [
      [
        "2024",
        {
          valuesScale: 1,
          values: { br: [2004] },
        },
      ],
      [
        "2025",
        {
          valuesScale: 1,
          values: { br: [2780], "2507507": [2] },
        },
      ],
    ];

    expect(buildSeriesData(years, "2507507", 0)).toEqual([
      { year: "2024", value: null },
      { year: "2025", value: 2 },
    ]);
  });

  it("keeps Brazil totals when Brazil is selected", () => {
    const years: Array<[string, CompactAnalysisYearData]> = [
      ["2025", { valuesScale: 1, values: { br: [2780] } }],
    ];

    expect(buildSeriesData(years, "br", 0)).toEqual([
      { year: "2025", value: 2780 },
    ]);
  });
});
