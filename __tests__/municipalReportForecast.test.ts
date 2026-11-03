import { describe, expect, it } from "vitest";
import type {
  MunicipalReportAnalysis,
  MunicipalReportForecastFacets,
} from "@/contracts/municipalReport";
import {
  buildReportDocumentSections,
  splitReportAnalysisTitle,
  listForecastGroupPeriods,
  resolveForecastGroupPeriod,
} from "@/utils/municipalReportForecast";

function snapshot(period: string) {
  return { period, label: period, distribution: [], dominantClass: null };
}

function analysis(
  id: string,
  forecast?: Partial<MunicipalReportForecastFacets>,
  periods: string[] = ["2026-11", "2026-12"],
  effectivePeriod: string | null = periods.at(-1) ?? null,
): MunicipalReportAnalysis {
  return {
    id,
    alias: id,
    title: id,
    category: "Dados Climáticos",
    unit: "%",
    valueType: "percentage",
    status: effectivePeriod ? "available" : "unavailable",
    requestedPeriod: "2026-12",
    effectivePeriod,
    classes: [],
    snapshot: effectivePeriod ? snapshot(effectivePeriod) : null,
    timeSeries: periods.map(snapshot),
    ...(forecast
      ? {
          forecast: {
            source: "INMET",
            variable: "Precipitação",
            kind: "Anomalia",
            periodicity: "monthly",
            ...forecast,
          },
        }
      : {}),
  };
}

describe("buildReportDocumentSections", () => {
  it("põe as fontes do mesmo índice lado a lado, na posição da primeira", () => {
    const titled = (id: string, title: string) => ({
      ...analysis(id),
      title,
    });
    const sections = buildReportDocumentSections([
      titled("era5", "Índice de Aridez - ERA5 Land"),
      titled("cdi", "Índice Combinado de Seca - CDI"),
      titled("dwgd", "Índice de Aridez - BR-DWGD"),
    ]);

    expect(
      sections.map((section) =>
        section.type === "analysis" ? section.analysis.id : section.type,
      ),
    ).toEqual(["era5", "dwgd", "cdi"]);
    expect(splitReportAnalysisTitle("Índice de Aridez - BR-DWGD")).toEqual({
      name: "Índice de Aridez",
      variant: "BR-DWGD",
    });
    expect(splitReportAnalysisTitle("Monitor de secas | ANA")).toBeNull();
  });

  it("junta os tipos da mesma fonte, variável e periodicidade numa seção, depois das análises comuns", () => {
    const sections = buildReportDocumentSections([
      analysis("prob", { kind: "Probabilidade" }),
      analysis("seca"),
      analysis("anom", { kind: "Anomalia" }),
      analysis("acum", { kind: "Acumulado" }),
    ]);

    expect(sections.map((section) => section.type)).toEqual([
      "analysis",
      "forecast",
    ]);
    const [, forecast] = sections;
    if (forecast.type !== "forecast") throw new Error("esperava previsão");
    // A ordem é a dos tipos, não a do formulário.
    expect(forecast.group.members.map(({ id }) => id)).toEqual([
      "anom",
      "acum",
      "prob",
    ]);
    expect(forecast.group).toMatchObject({
      alias: "previsao_inmet_precipitacao_monthly",
      source: "INMET",
      variable: "Precipitação",
      periodicity: "monthly",
      category: "Dados Climáticos",
      showPeriodicity: false,
    });
  });

  it("separa fonte, variável e periodicidade, e só põe a periodicidade no título quando ela distingue", () => {
    const sections = buildReportDocumentSections([
      analysis("inmet-mensal", {}),
      analysis("inmet-trimestral", { periodicity: "quarterly" }),
      analysis("cptec", { source: "CPTEC" }),
      analysis("temperatura", { variable: "Temperatura" }),
    ]);

    const groups = sections.flatMap((section) =>
      section.type === "forecast" ? [section.group] : [],
    );
    expect(groups.map((group) => [group.alias, group.showPeriodicity])).toEqual(
      [
        ["previsao_cptec_precipitacao_monthly", false],
        ["previsao_inmet_precipitacao_monthly", true],
        ["previsao_inmet_precipitacao_quarterly", true],
        ["previsao_inmet_temperatura_monthly", false],
      ],
    );
  });

  it("ordena as previsões por variável, periodicidade e fonte, no fim da categoria", () => {
    const sections = buildReportDocumentSections([
      analysis("temp-tri-inmet", {
        variable: "Temperatura",
        periodicity: "quarterly",
      }),
      analysis("prec-tri-cptec", { source: "CPTEC", periodicity: "quarterly" }),
      analysis("seca"),
      analysis("prec-men-inmet", {}),
      analysis("temp-men-cptec", { variable: "Temperatura", source: "CPTEC" }),
      analysis("prec-men-cptec", { source: "CPTEC" }),
      { ...analysis("pobreza"), category: "Dados Socioeconômicos" },
    ]);

    expect(
      sections.map((section) =>
        section.type === "analysis"
          ? section.analysis.id
          : section.group.members[0].id,
      ),
    ).toEqual([
      "seca",
      "prec-men-cptec",
      "prec-men-inmet",
      "prec-tri-cptec",
      "temp-men-cptec",
      "temp-tri-inmet",
      "pobreza",
    ]);
  });

  it("trata grafias diferentes do mesmo valor como o mesmo grupo", () => {
    const sections = buildReportDocumentSections([
      analysis("a", { variable: "Precipitação" }),
      analysis("b", { variable: "precipitacao", kind: "Acumulado" }),
    ]);

    expect(sections).toHaveLength(1);
  });
});

describe("período do grupo", () => {
  it("usa o período mais comum entre os tipos, e a série junta todos", () => {
    const [section] = buildReportDocumentSections([
      analysis("anom", { kind: "Anomalia" }, ["2026-11", "2026-12"]),
      analysis("acum", { kind: "Acumulado" }, ["2026-10", "2026-12"]),
      analysis("prob", { kind: "Probabilidade" }, ["2026-11"], "2026-11"),
      analysis("outro", { kind: "Outro" }, [], null),
    ]);
    if (section.type !== "forecast") throw new Error("esperava previsão");

    expect(resolveForecastGroupPeriod(section.group)).toBe("2026-12");
    expect(listForecastGroupPeriods(section.group)).toEqual([
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
  });

  it("cai no período pedido quando nenhum tipo tem dado", () => {
    const [section] = buildReportDocumentSections([
      analysis("anom", {}, [], null),
    ]);
    if (section.type !== "forecast") throw new Error("esperava previsão");

    expect(resolveForecastGroupPeriod(section.group)).toBe("2026-12");
  });
});
