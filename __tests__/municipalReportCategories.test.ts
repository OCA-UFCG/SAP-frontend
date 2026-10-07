import { describe, expect, it } from "vitest";
import {
  formatReportPeriodPill,
  getReportCategoryTokens,
  groupReportAnalysesByCategory,
  REPORT_CATEGORY_TOKENS,
  reportAnalysisAnchorId,
  resolveReportCategoryKey,
} from "@/utils/municipalReportCategories";
import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";

function analysis(alias: string, category?: string): MunicipalReportAnalysis {
  return {
    id: alias,
    alias,
    title: alias,
    unit: "%",
    valueType: "percentage",
    status: "available",
    requestedPeriod: "2026",
    effectivePeriod: "2026-05",
    classes: [],
    snapshot: null,
    timeSeries: [],
    ...(category ? { category } : {}),
  };
}

describe("resolveReportCategoryKey", () => {
  it("ignora acento e caixa", () => {
    expect(resolveReportCategoryKey("dados climáticos")).toBe("climate");
    expect(resolveReportCategoryKey("DADOS CLIMATICOS")).toBe("climate");
    expect(resolveReportCategoryKey("Dados Socioeconômicos")).toBe(
      "socioeconomic",
    );
  });

  it("cai em others quando a categoria é desconhecida, vazia ou ausente", () => {
    expect(resolveReportCategoryKey("Dados Hídricos")).toBe("others");
    expect(resolveReportCategoryKey("   ")).toBe("others");
    expect(resolveReportCategoryKey(undefined)).toBe("others");
  });
});

describe("getReportCategoryTokens", () => {
  it("devolve os tokens da categoria resolvida", () => {
    expect(getReportCategoryTokens("Dados Ambientais")).toBe(
      REPORT_CATEGORY_TOKENS.environmental,
    );
  });

  it("devolve os tokens de others para categoria ausente", () => {
    expect(getReportCategoryTokens(undefined)).toBe(
      REPORT_CATEGORY_TOKENS.others,
    );
  });
});

describe("groupReportAnalysesByCategory", () => {
  it("agrupa na ordem climático, ambiental, socioeconômico", () => {
    const groups = groupReportAnalysesByCategory([
      analysis("pobreza", "Dados Socioeconômicos"),
      analysis("seca", "Dados Climáticos"),
      analysis("degradacao", "Dados Ambientais"),
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      "climate",
      "environmental",
      "socioeconomic",
    ]);
  });

  it("preserva a ordem original dentro de cada grupo", () => {
    const groups = groupReportAnalysesByCategory([
      analysis("cdi", "Dados Climáticos"),
      analysis("seca", "Dados Climáticos"),
    ]);

    expect(groups[0].analyses.map((item) => item.alias)).toEqual([
      "cdi",
      "seca",
    ]);
  });

  it("não devolve grupo vazio", () => {
    const groups = groupReportAnalysesByCategory([
      analysis("seca", "Dados Climáticos"),
    ]);

    expect(groups).toHaveLength(1);
  });

  it("recolhe em others as análises sem categoria", () => {
    const groups = groupReportAnalysesByCategory([
      analysis("seca", "Dados Climáticos"),
      analysis("legado"),
    ]);

    expect(groups.map((group) => group.key)).toEqual(["climate", "others"]);
  });
});

describe("formatReportPeriodPill", () => {
  it("mostra mês/ano para período mensal", () => {
    expect(formatReportPeriodPill("2026-05")).toBe("05/2026");
  });

  it("mostra só o ano para período anual", () => {
    expect(formatReportPeriodPill("2021")).toBe("2021");
  });

  it("devolve travessão quando não há período", () => {
    expect(formatReportPeriodPill(null)).toBe("—");
    expect(formatReportPeriodPill(undefined)).toBe("—");
  });
});

describe("reportAnalysisAnchorId", () => {
  it("prefixa o alias", () => {
    expect(reportAnalysisAnchorId("seca")).toBe("report-analysis-seca");
  });
});
