import { beforeAll, describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { MunicipalReportStackedChart } from "@/components/MunicipalReport/MunicipalReportStackedChart";
import { MunicipalReportStackedPrintChart } from "@/components/MunicipalReport/MunicipalReportStackedPrintChart";
import type {
  MunicipalReportAnalysis,
  MunicipalReportPeriodSnapshot,
} from "@/contracts/municipalReport";

beforeAll(() => {
  // O ResponsiveContainer só desenha com dimensão; no jsdom ela é zero.
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", {
    configurable: true,
    value: 400,
  });
});

function snapshot(
  period: string,
  values: Record<string, number>,
): MunicipalReportPeriodSnapshot {
  const distribution = Object.entries(values).map(([id, percentage]) => ({
    id,
    label: id === "sem-seca" ? "Sem seca" : "Seca fraca",
    color: id === "sem-seca" ? "#CCCCCC" : "#FFEB00",
    percentage,
  }));

  return {
    period,
    label: period,
    distribution,
    dominantClass: distribution.reduce((best, item) =>
      item.percentage > best.percentage ? item : best,
    ),
  };
}

const analysis = {
  id: "anaseca",
  alias: "seca",
  title: "Monitor de Secas",
  unit: "%",
  valueType: "percentage" as const,
  status: "available" as const,
  requestedPeriod: "2026-05",
  effectivePeriod: "2026-05",
  snapshot: null,
  classes: [
    { id: "sem-seca", label: "Sem seca", color: "#CCCCCC" },
    { id: "seca-fraca", label: "Seca fraca", color: "#FFEB00" },
  ],
  timeSeries: [
    snapshot("2026-04", { "sem-seca": 72, "seca-fraca": 28 }),
    snapshot("2026-05", { "sem-seca": 28.3, "seca-fraca": 71.7 }),
  ],
} as MunicipalReportAnalysis;

describe("MunicipalReportStackedChart", () => {
  function renderChart(current = analysis) {
    return render(
      <MunicipalReportStackedChart
        analysis={current}
        locale="pt-BR"
        referencePeriod="2026-05"
        translateLabel={(label) => label}
      />,
    );
  }

  it("lista uma entrada de legenda por classe do índice", () => {
    const { container } = renderChart();
    const scope = within(container);

    expect(scope.getByText("Sem seca")).toBeTruthy();
    expect(scope.getByText("Seca fraca")).toBeTruthy();
  });

  it("anuncia o intervalo desenhado para leitor de tela", () => {
    const { container } = renderChart();
    const figure = container.querySelector("[role='img']");

    expect(figure?.getAttribute("aria-label")).toContain("2026-04");
    expect(figure?.getAttribute("aria-label")).toContain("2026-05");
  });

  it("não renderiza nada quando a série está vazia", () => {
    const { container } = renderChart({
      ...analysis,
      timeSeries: [],
    } as MunicipalReportAnalysis);

    expect(container.querySelector("[role='img']")).toBeNull();
  });
});

describe("MunicipalReportStackedPrintChart", () => {
  function renderPrintChart(current = analysis) {
    return render(
      <MunicipalReportStackedPrintChart
        analysis={current}
        referencePeriod="2026-05"
        translateLabel={(label) => label}
      />,
    );
  }

  it("desenha um retângulo por classe por período", () => {
    const { container } = renderPrintChart();

    expect(container.querySelectorAll("[data-stack-segment]")).toHaveLength(4);
  });

  it("empilha de baixo para cima na ordem das classes", () => {
    const { container } = renderPrintChart();
    const first = container.querySelector(
      '[data-stack-segment="2026-04:sem-seca"]',
    )!;
    const second = container.querySelector(
      '[data-stack-segment="2026-04:seca-fraca"]',
    )!;

    expect(Number(first.getAttribute("y"))).toBeGreaterThan(
      Number(second.getAttribute("y")),
    );
  });

  it("preenche a coluna inteira: as duas classes somam a altura do plot", () => {
    const { container } = renderPrintChart();
    const heights = ["sem-seca", "seca-fraca"].map((id) =>
      Number(
        container
          .querySelector(`[data-stack-segment="2026-05:${id}"]`)!
          .getAttribute("height"),
      ),
    );

    expect(heights[0] + heights[1]).toBeCloseTo(242, 6);
  });

  it("omite a classe de valor zero em vez de desenhar um retângulo sem altura", () => {
    const { container } = renderPrintChart({
      ...analysis,
      timeSeries: [snapshot("2026-05", { "sem-seca": 0, "seca-fraca": 100 })],
    } as MunicipalReportAnalysis);

    expect(
      container.querySelector('[data-stack-segment="2026-05:sem-seca"]'),
    ).toBeNull();
    expect(
      container.querySelector('[data-stack-segment="2026-05:seca-fraca"]'),
    ).toBeTruthy();
  });

  it("rotula todos os períodos desenhados, sem omitir nenhuma data", () => {
    const series = Array.from({ length: 29 }, (_, index) =>
      snapshot(`2024-${String(index + 1).padStart(2, "0")}`, {
        "sem-seca": 40,
        "seca-fraca": 60,
      }),
    );
    const { container } = renderPrintChart({
      ...analysis,
      timeSeries: series,
    } as MunicipalReportAnalysis);

    const colunas = new Set(
      [...container.querySelectorAll("[data-stack-segment]")].map((node) =>
        node.getAttribute("data-stack-segment")!.split(":")[0],
      ),
    );
    const rotulos = container.querySelectorAll("text");
    const rotulosDePeriodo = [...rotulos].filter((node) =>
      /^\d{4}-\d{2}\*?$/.test(node.textContent ?? ""),
    );

    expect(colunas.size).toBeGreaterThan(1);
    expect(rotulosDePeriodo).toHaveLength(colunas.size);
  });

  it("usa viewBox fixo, sem depender de medida do contêiner", () => {
    const { container } = renderPrintChart();

    expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(
      "0 0 640 330",
    );
  });

  it("não renderiza nada quando a série está vazia", () => {
    const { container } = renderPrintChart({
      ...analysis,
      timeSeries: [],
    } as MunicipalReportAnalysis);

    expect(container.querySelector("svg")).toBeNull();
  });
});
