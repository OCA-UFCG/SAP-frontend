import { describe, expect, it } from "vitest";
import type {
  MunicipalReportAnalysis,
  MunicipalReportDocsContent,
} from "@/contracts/municipalReport";
import {
  buildAnalysisNarrativeSections,
  buildHistoryNarrative,
  buildSituationNarrative,
} from "@/utils/municipalReportNarrative";

function analysis(id = "anaseca"): MunicipalReportAnalysis {
  return {
    id,
    alias: "seca",
    title: "Monitor de Secas",
    unit: "%",
    valueType: "percentage",
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
        {
          title: "Situação atual",
          text: "Texto gerado para a situação atual.",
        },
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
    expect(
      buildHistoryNarrative(analysis("indicearidez"), {
        anaseca: [{ title: "Tendência recente", text: "Texto de outro tema." }],
      }),
    ).toBeNull();
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

    expect(
      buildAnalysisNarrativeSections(analysis("indicearidez"), docsContent),
    ).toEqual([
      { title: "Situação atual", text: "Detalhamento histórico." },
      { title: "Classificação climática", text: "Classificação." },
      { title: "Evolução decenal", text: "Evolução." },
    ]);
  });

  it("describes absolute indicators as raw municipal totals", () => {
    const absoluteAnalysis: MunicipalReportAnalysis = {
      ...analysis("s2id_secas_estiagens"),
      alias: "s2id_secas_estiagens",
      title: "Registros de Secas e Estiagens (2004-2025)",
      unit: "registros",
      valueType: "absolute",
      effectivePeriod: "2025",
      snapshot: {
        period: "2025",
        label: "2025",
        distribution: [
          {
            id: "registros",
            label: "Registros de secas e estiagens",
            color: "#8c2d04",
            percentage: 7,
          },
        ],
        dominantClass: {
          id: "registros",
          label: "Registros de secas e estiagens",
          color: "#8c2d04",
          percentage: 7,
        },
      },
    };

    expect(
      buildSituationNarrative(
        absoluteAnalysis,
        null,
        {
          schemaVersion: 1,
          generatedAt: "2026-07-14T00:00:00.000Z",
          requestedPeriod: "2025",
          municipality: { code: "3100609", name: "Abaeté", uf: "MG" },
          analyses: [absoluteAnalysis],
          templateVariables: {},
        },
        {
          sectionColor: "#176b39",
          coverageContext: "classificada nessa categoria",
          methodology: "Fonte S2ID.",
        },
        "pt-BR",
      ),
    ).toContain("o valor de Registros de secas e estiagens é 7 registros");
  });
});
