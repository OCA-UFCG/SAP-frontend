import { describe, expect, it } from "vitest";
import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import {
  buildMunicipalReportChartData,
  MUNICIPAL_REPORT_PDF_CHART_MAX_MEASUREMENTS,
  resolveMunicipalReportChartAxisMax,
} from "@/utils/municipalReportChart";

const analysis: MunicipalReportAnalysis = {
  id: "layer-a",
  alias: "seca",
  title: "Seca & Aridez <Teste>",
  unit: "%",
  valueType: "percentage",
  status: "available",
  requestedPeriod: "2024-03",
  effectivePeriod: "2024-03",
  classes: [
    { id: "neutral", label: "Neutro", color: "#687076" },
    { id: "moderate", label: "Moderado", color: "#d9a441" },
    { id: "severe", label: "Severo", color: "#b8452c" },
  ],
  snapshot: null,
  timeSeries: [
    {
      period: "2024-03",
      label: "Mar 2024",
      dominantClass: null,
      distribution: [
        { id: "neutral", label: "Neutro", color: "#687076", percentage: 20 },
        { id: "moderate", label: "Moderado", color: "#d9a441", percentage: 35 },
        { id: "severe", label: "Severo", color: "#b8452c", percentage: 45 },
      ],
    },
    {
      period: "2024-01",
      label: "Jan 2024",
      dominantClass: null,
      distribution: [
        { id: "neutral", label: "Neutro", color: "#687076", percentage: 75 },
        { id: "moderate", label: "Moderado", color: "#d9a441", percentage: 25 },
      ],
    },
    {
      period: "2024-02",
      label: "Fev 2024",
      dominantClass: null,
      distribution: [
        { id: "neutral", label: "Neutro", color: "#687076", percentage: 50 },
        { id: "moderate", label: "Moderado", color: "#d9a441", percentage: 30 },
        { id: "severe", label: "Severo", color: "#b8452c", percentage: 20 },
      ],
    },
  ],
};

describe("municipal report chart", () => {
  it("builds sorted complete series for every class", () => {
    const chartData = buildMunicipalReportChartData(analysis, "2024-03");

    expect(chartData.categories.map((category) => category.period)).toEqual([
      "2024-01",
      "2024-02",
      "2024-03",
    ]);
    expect(chartData.referencePeriod).toBe("2024-03");
    expect(
      chartData.categories.map((category) => category.highlighted),
    ).toEqual([false, false, true]);
    expect(chartData.series.map((series) => series.id)).toEqual([
      "neutral",
      "moderate",
      "severe",
    ]);
    expect(
      chartData.series
        .find((series) => series.id === "severe")
        ?.points.map((point) => point.value),
    ).toEqual([0, 20, 45]);
  });

  it("keeps the site history complete and limits only PDF data to the 10 most recent measurements", () => {
    const timeSeries = Array.from({ length: 25 }, (_, index) => {
      const year = 2023 + Math.floor(index / 12);
      const month = String((index % 12) + 1).padStart(2, "0");
      const period = `${year}-${month}`;

      return {
        period,
        label: period,
        dominantClass: null,
        distribution: [
          {
            id: "neutral",
            label: "Neutro",
            color: "#687076",
            percentage: index,
          },
        ],
      };
    }).reverse();
    const siteChartData = buildMunicipalReportChartData(
      { ...analysis, timeSeries },
      "2025-01",
    );
    const pdfChartData = buildMunicipalReportChartData(
      { ...analysis, timeSeries },
      "2025-01",
      { maxMeasurements: MUNICIPAL_REPORT_PDF_CHART_MAX_MEASUREMENTS },
    );

    expect(siteChartData.categories).toHaveLength(25);
    expect(siteChartData.categories[0]?.period).toBe("2023-01");
    expect(siteChartData.categories.at(-1)?.period).toBe("2025-01");
    expect(pdfChartData.categories).toHaveLength(
      MUNICIPAL_REPORT_PDF_CHART_MAX_MEASUREMENTS,
    );
    expect(pdfChartData.categories[0]?.period).toBe("2024-04");
    expect(pdfChartData.categories.at(-1)?.period).toBe("2025-01");
    expect(pdfChartData.series[0]?.points.map((point) => point.value)).toEqual(
      Array.from({ length: 10 }, (_, index) => index + 15),
    );
  });
});

describe("resolveMunicipalReportChartAxisMax", () => {
  it("mantém 100 nos percentuais", () => {
    expect(resolveMunicipalReportChartAxisMax("percentage", 52.3)).toBe(100);
  });

  it("escolhe um topo redondo logo acima do maior valor absoluto", () => {
    // O IDH (0 a 1) não fica esmagado num eixo até 5.
    expect(resolveMunicipalReportChartAxisMax("absolute", 0.8)).toBeCloseTo(1);
    expect(resolveMunicipalReportChartAxisMax("absolute", 3)).toBe(5);
    expect(resolveMunicipalReportChartAxisMax("absolute", 28_442_130_794)).toBe(
      50_000_000_000,
    );
    expect(resolveMunicipalReportChartAxisMax("absolute", 0)).toBe(1);
  });
});
