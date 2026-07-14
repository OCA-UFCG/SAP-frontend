import { describe, expect, it, vi } from "vitest";
import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import { renderMunicipalReportChart } from "@/services/municipalReportChartRenderer";
import { buildMunicipalReportChartData } from "@/utils/municipalReportChart";

vi.mock("server-only", () => ({}));

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

  it("renders an escaped SVG line chart with every class and full history", async () => {
    const svg = (
      await renderMunicipalReportChart(analysis, {
        highlightPeriod: "2024-03",
      })
    ).toString("utf8");

    expect(svg).toContain("<polyline");
    expect(svg.match(/<polyline/g)).toHaveLength(3);
    expect(svg).toContain("Neutro");
    expect(svg).toContain("Moderado");
    expect(svg).toContain("Severo");
    expect(svg).toContain("Jan 2024");
    expect(svg).toContain("Mar 2024");
    expect(svg).toContain("Seca &amp; Aridez &lt;Teste&gt;");
    expect(svg).toContain("stroke-dasharray");
    expect(svg).not.toContain("<rect x=");
  });

  it("uses the observed range and absolute unit instead of a percentage axis", async () => {
    const absoluteAnalysis: MunicipalReportAnalysis = {
      ...analysis,
      title: "Registros de seca e estiagem",
      unit: "registros",
      valueType: "absolute",
      timeSeries: analysis.timeSeries.map((snapshot, index) => ({
        ...snapshot,
        distribution: [
          {
            id: "neutral",
            label: "Registros",
            color: "#687076",
            percentage: [120, 260, 410][index]!,
          },
        ],
      })),
      classes: [{ id: "neutral", label: "Registros", color: "#687076" }],
    };

    const svg = (
      await renderMunicipalReportChart(absoluteAnalysis, {
        highlightPeriod: "2024-03",
      })
    ).toString("utf8");

    expect(svg).toContain(">410</text>");
    expect(svg).toContain("por classe (registros) - referencia");
    expect(svg).not.toContain(">100%</text>");
  });
});
