import { describe, expect, it } from "vitest";
import {
  buildSeriesData,
  buildTemporalTableRows,
} from "@/components/analysis/TemporalVision";
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

describe("buildTemporalTableRows", () => {
  it("põe um período por linha e uma classe por coluna, para a tabela alternativa", () => {
    const rows = buildTemporalTableRows(
      {
        "2025": { valuesScale: 1, values: { br: [30, 70] } },
        "2024": { valuesScale: 10, values: { br: [125, 875] } },
      },
      [
        { id: "1", label: "Sem seca", color: "#ccc" },
        { id: "2", label: "Seca", color: "#f00" },
      ],
      "br",
    );

    expect(rows).toEqual([
      { period: "2024", label: "2024", values: { "0": 12.5, "1": 87.5 } },
      { period: "2025", label: "2025", values: { "0": 30, "1": 70 } },
    ]);
  });
});
