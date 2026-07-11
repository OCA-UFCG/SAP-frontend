import { describe, expect, it } from "vitest";
import type { MunicipalReportAnalysis, MunicipalReportDocsContent } from "@/contracts/municipalReport";
import { buildHistoryNarrative, buildSituationNarrative } from "@/utils/municipalReportNarrative";

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
      DROUGHT_MONITOR: [
        { title: "Situação atual", text: "Texto gerado para a situação atual." },
      ],
    };

    expect(buildSituationNarrative(analysis(), docsContent)).toBe(
      "Texto gerado para a situação atual.",
    );
  });

  it("uses generated Docs content for recent and historical narratives", () => {
    const docsContent: MunicipalReportDocsContent = {
      DROUGHT_MONITOR: [
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
      DROUGHT_MONITOR: [
        { title: "Tendência recente", text: "Texto de outro tema." },
      ],
    })).toBeNull();
  });
});
