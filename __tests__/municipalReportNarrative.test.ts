import { describe, expect, it } from "vitest";
import { resolveReportTerritory } from "@/utils/reportTerritory";
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
          territory: resolveReportTerritory("3100609")!,
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

  // Em inglês e espanhol o texto do catálogo não vale, e é esta frase que
  // aparece: ela precisa dizer quanto da área está em seca, não só a maior classe.
  it("opens the automatic situation with the class distribution", () => {
    const item = (id: string, label: string, percentage: number) => ({
      id,
      label,
      color: "#000000",
      percentage,
    });
    const distribution = [
      item("classe-0", "Sem seca", 35.1),
      item("classe-1", "Seca fraca", 31.9),
      item("classe-2", "Seca moderada", 18.4),
      item("classe-3", "Seca grave", 10),
      item("classe-4", "Seca extrema", 4.6),
    ];
    const drought: MunicipalReportAnalysis = {
      ...analysis("monitor-de-secas"),
      effectivePeriod: "2026-01",
      severity: {
        order: ["classe-0", "classe-1", "classe-2", "classe-3", "classe-4"],
        neutralClassId: "classe-0",
      },
      snapshot: {
        period: "2026-01",
        label: "2026-01",
        distribution,
        dominantClass: distribution[0],
      },
    };

    expect(
      buildSituationNarrative(
        drought,
        null,
        {
          schemaVersion: 1,
          generatedAt: "2026-10-28T00:00:00.000Z",
          requestedPeriod: "2026-01",
          territory: resolveReportTerritory("br")!,
          analyses: [drought],
          templateVariables: {},
        },
        {
          sectionColor: "#176b39",
          coverageContext: "classificada nessa categoria",
          methodology: "Fonte ANA.",
        },
        "pt-BR",
      ),
    ).toBe(
      "No Brasil, conforme os dados de Monitor de Secas para o período de janeiro de 2026, 64,90% da área está em classes piores que Sem seca: Seca fraca (31,90%), Seca moderada (18,40%), Seca grave (10,00%) e Seca extrema (4,60%); o restante (35,10%) está em Sem seca.",
    );
  });
});
