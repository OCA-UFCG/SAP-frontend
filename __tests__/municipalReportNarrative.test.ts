import { describe, expect, it } from "vitest";
import type { MunicipalReportAnalysis, MunicipalReportDocsContent } from "@/contracts/municipalReport";
import { buildAnalysisNarrativeSections, buildHistoryNarrative, buildSituationNarrative } from "@/utils/municipalReportNarrative";

function analysis(id = "anaseca"): MunicipalReportAnalysis {
  return {
    id,
    alias: "seca",
    title: "Monitor de Secas",
    unit: "%",
    status: "available",
    requestedPeriod: "2026",
    effectivePeriod: "2026-02",
    classes: [],
    snapshot: null,
    timeSeries: [],
  };
}

describe("municipal report narrative", () => {
  it("uses generated Docs content for the situation narrative", () => {
    const docsContent: MunicipalReportDocsContent = {
      anaseca: [
        { title: "Situação atual", text: "Texto gerado para a situação atual." },
      ],
    };

    expect(buildSituationNarrative(analysis(), docsContent)).toBe(
      "Texto gerado para a situação atual.",
    );
  });

  it("uses generated Docs content for recent and historical narratives", () => {
    const docsContent: MunicipalReportDocsContent = {
      anaseca: [
        { title: "Tendencia recente", text: "Texto gerado para tendência." },
        { title: "Contexto histórico", text: "Texto gerado para contexto." },
      ],
    };

    expect(buildHistoryNarrative(analysis(), docsContent)).toEqual({
      recent: "Texto gerado para tendência.",
      context: "Texto gerado para contexto.",
    });
  });

  it("returns null when there is no generated content for the analysis theme", () => {
    expect(buildHistoryNarrative(analysis("indicearidez"), {
      anaseca: [
        { title: "Tendência recente", text: "Texto de outro tema." },
      ],
    })).toBeNull();
  });

  it("returns every non-situation section for aridity and degradation layouts", () => {
    const docsContent: MunicipalReportDocsContent = {
      indicearidez: [
        { title: "Situação atual", text: "Resumo." },
        { title: "Situação atual", text: "Detalhamento histórico." },
        { title: "Classificação climática", text: "Classificação." },
        { title: "Evolução decenal", text: "Evolução." },
      ],
    };

    expect(buildAnalysisNarrativeSections(analysis("indicearidez"), docsContent)).toEqual([
      { title: "Situação atual", text: "Detalhamento histórico." },
      { title: "Classificação climática", text: "Classificação." },
      { title: "Evolução decenal", text: "Evolução." },
    ]);
  });
});
