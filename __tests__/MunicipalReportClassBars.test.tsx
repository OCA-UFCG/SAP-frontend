import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { MunicipalReportClassBars } from "@/components/MunicipalReport/MunicipalReportClassBars";
import { ReportSectionHeading } from "@/components/MunicipalReport/ReportSectionHeading";
import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";

function buildAnalysis(
  overrides: Partial<MunicipalReportAnalysis> = {},
): MunicipalReportAnalysis {
  return {
    id: "anaseca",
    alias: "seca",
    title: "Monitor de Secas",
    unit: "%",
    valueType: "percentage",
    status: "available",
    requestedPeriod: "2026",
    effectivePeriod: "2026-05",
    classes: [],
    timeSeries: [],
    snapshot: {
      period: "2026-05",
      label: "2026-05",
      dominantClass: null,
      distribution: [
        {
          id: "sem-seca",
          label: "Sem seca",
          color: "#CCCCCC",
          percentage: 28.3,
        },
        {
          id: "seca-fraca",
          label: "Seca fraca",
          color: "#FFEB00",
          percentage: 71.7,
        },
        {
          id: "seca-moderada",
          label: "Seca moderada",
          color: "#E1AF32",
          percentage: 0,
        },
      ],
    },
    ...overrides,
  };
}

function renderBars(analysis = buildAnalysis()) {
  return render(
    <MunicipalReportClassBars
      analysis={analysis}
      locale="pt-BR"
      translateLabel={(label) => label}
    />,
  );
}

describe("MunicipalReportClassBars", () => {
  it("usa escala fixa de 0 a 100 num índice percentual", () => {
    const { container } = renderBars();
    const bars = container.querySelectorAll("[data-report-class-bar]");

    expect((bars[0] as HTMLElement).style.width).toBe("28.3%");
    expect((bars[1] as HTMLElement).style.width).toBe("71.7%");
  });

  it("desenha uma marca visível para a classe de valor zero", () => {
    const { container } = renderBars();
    const zeroBar = container.querySelectorAll(
      "[data-report-class-bar]",
    )[2] as HTMLElement;

    expect(zeroBar.style.width).toBe("0%");
    expect(zeroBar.style.minWidth).toBe("2px");
  });

  it("usa a cor da classe sem escurecer", () => {
    const { container } = renderBars();
    const bar = container.querySelectorAll(
      "[data-report-class-bar]",
    )[1] as HTMLElement;

    expect(bar.style.backgroundColor).toBe("rgb(255, 235, 0)");
  });

  it("escala pelo maior valor num índice absoluto", () => {
    const { container } = renderBars(
      buildAnalysis({
        valueType: "absolute",
        unit: "registros",
        snapshot: {
          period: "2026",
          label: "2026",
          dominantClass: null,
          distribution: [
            { id: "a", label: "A", color: "#123456", percentage: 40 },
            { id: "b", label: "B", color: "#654321", percentage: 10 },
          ],
        },
      }),
    );
    const bars = container.querySelectorAll("[data-report-class-bar]");

    expect((bars[0] as HTMLElement).style.width).toBe("100%");
    expect((bars[1] as HTMLElement).style.width).toBe("25%");
  });

  // Regressão: com a barra e a porcentagem dentro da mesma célula, uma classe
  // de 100% ocupava a célula inteira e empurrava o número para fora da margem
  // da folha, que no PDF do Relatório Automático saía cortado ao meio.
  it("mantém a porcentagem numa coluna própria, fora da célula da barra", () => {
    const { container } = renderBars(
      buildAnalysis({
        snapshot: {
          period: "2026-05",
          label: "2026-05",
          dominantClass: null,
          distribution: [
            {
              id: "seca-fraca",
              label: "Seca fraca",
              color: "#FFEB00",
              percentage: 100,
            },
          ],
        },
      }),
    );
    const row = container.querySelector("tr") as HTMLElement;
    const cells = row.querySelectorAll("td");

    expect(cells).toHaveLength(2);
    expect(cells[0].querySelector("[data-report-class-bar]")).toBeTruthy();
    expect(cells[0].textContent).toBe("");
    expect(cells[1].textContent).toContain("100");
  });

  it("expõe os valores como tabela acessível", () => {
    const { container } = renderBars();
    const scope = within(container);

    expect(scope.getByRole("table")).toBeTruthy();
    expect(scope.getByRole("rowheader", { name: "Seca fraca" })).toBeTruthy();
  });

  it("não renderiza nada quando não há distribuição", () => {
    const { container } = renderBars(buildAnalysis({ snapshot: null }));

    expect(container.querySelector("table")).toBeNull();
  });
});

describe("ReportSectionHeading", () => {
  it("renderiza no nível pedido", () => {
    const { container } = render(
      <ReportSectionHeading level={3} accent="#69B4CD">
        Situação
      </ReportSectionHeading>,
    );

    expect(
      within(container).getByRole("heading", { level: 3, name: "Situação" }),
    ).toBeTruthy();
  });

  it("aplica a cor de acento na barra", () => {
    const { container } = render(
      <ReportSectionHeading level={2} accent="#DF9A46">
        Notas
      </ReportSectionHeading>,
    );
    const bar = container.querySelector(
      "[data-report-accent-bar]",
    ) as HTMLElement;

    expect(bar.style.backgroundColor).toBe("rgb(223, 154, 70)");
  });
});
