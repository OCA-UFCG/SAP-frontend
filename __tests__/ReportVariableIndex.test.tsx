import { describe, expect, it } from "vitest";
import { render, within } from "@testing-library/react";
import { ReportVariableIndex } from "@/components/MunicipalReport/ReportVariableIndex";
import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";

function analysis(
  alias: string,
  title: string,
  category?: string,
  effectivePeriod: string | null = "2026-05",
): MunicipalReportAnalysis {
  return {
    id: alias,
    alias,
    title,
    unit: "%",
    valueType: "percentage",
    status: "available",
    requestedPeriod: "2026",
    effectivePeriod,
    classes: [],
    snapshot: null,
    timeSeries: [],
    ...(category ? { category } : {}),
  };
}

function renderIndex(analyses: MunicipalReportAnalysis[]) {
  return render(
    <ReportVariableIndex
      analyses={analyses}
      translateTitle={(item) => item.title}
    />,
  );
}

describe("ReportVariableIndex", () => {
  it("monta uma coluna por categoria presente, e nenhuma vazia", () => {
    const { container } = renderIndex([
      analysis("seca", "Monitor de seca | ANA", "Dados Climáticos"),
      analysis("pobreza", "Percentual de pobreza", "Dados Socioeconômicos"),
    ]);
    const scope = within(container);

    expect(
      scope.getByRole("heading", { name: "Dados Climáticos" }),
    ).toBeTruthy();
    expect(
      scope.getByRole("heading", { name: "Dados Socioeconômicos" }),
    ).toBeTruthy();
    expect(
      scope.queryByRole("heading", { name: "Dados Ambientais" }),
    ).toBeNull();
  });

  it("aponta cada item para a âncora da seção", () => {
    const { container } = renderIndex([
      analysis("seca", "Monitor de seca | ANA", "Dados Climáticos"),
    ]);

    expect(
      within(container).getByRole("link").getAttribute("href"),
    ).toBe("#report-analysis-seca");
  });

  it("mostra o período efetivo na pílula, aceitando mensal e anual lado a lado", () => {
    const { container } = renderIndex([
      analysis("seca", "Monitor de seca | ANA", "Dados Climáticos"),
      analysis("aridez", "Índice de Aridez", "Dados Climáticos", "2020"),
    ]);
    const scope = within(container);

    expect(scope.getByText("05/2026")).toBeTruthy();
    expect(scope.getByText("2020")).toBeTruthy();
  });

  it("não renderiza nada sem análises", () => {
    const { container } = renderIndex([]);

    expect(container.querySelector(".report-variable-index")).toBeNull();
  });
});
