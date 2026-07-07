import { describe, expect, it } from "vitest";
import { MUNICIPAL_REPORT_LAYERS } from "@/config/municipalReport";
import type { MunicipalReportAnalysis, MunicipalReportPeriodSnapshot } from "@/contracts/municipalReport";
import { buildHistoryNarrative } from "@/utils/municipalReportNarrative";

const presentation = MUNICIPAL_REPORT_LAYERS[0].presentation;

function snapshot(period: string, id: string, label: string): MunicipalReportPeriodSnapshot {
  const dominantClass = { id, label, color: "#ffffff", percentage: 100 };
  return { period, label: period, distribution: [dominantClass], dominantClass };
}

function analysis(series: MunicipalReportPeriodSnapshot[]): MunicipalReportAnalysis {
  return {
    id: "anaseca", alias: "seca", title: "Monitor de Secas", unit: "%",
    status: "available", requestedPeriod: "2026", effectivePeriod: series.at(-1)!.period,
    classes: [], snapshot: series.at(-1)!, timeSeries: series,
  };
}

describe("municipal report narrative", () => {
  it("describes a transition to the neutral class without awkward severity wording", () => {
    const text = buildHistoryNarrative(analysis([
      snapshot("2026-01", "seca-fraca", "Seca fraca"),
      snapshot("2026-02", "sem-seca", "Sem seca"),
    ]), "Alfredo Chaves", presentation, "pt-BR");

    expect(text?.recent).toContain("Houve melhora em relação ao mês anterior");
    expect(text?.recent).toContain("no período atual não predomina condição de seca");
    expect(text?.recent).not.toContain("amenizando a situação");
  });

  it("describes stability without inferring an improvement or worsening", () => {
    const text = buildHistoryNarrative(analysis([
      snapshot("2026-01", "seca-moderada", "Seca moderada"),
      snapshot("2026-02", "seca-moderada", "Seca moderada"),
    ]), "Alfredo Chaves", presentation, "pt-BR");

    expect(text?.recent).toContain("permaneceu estável");
    expect(text?.recent).toContain("Seca moderada (D1)");
  });

  it("uses configured rank to describe worsening between non-neutral classes", () => {
    const text = buildHistoryNarrative(analysis([
      snapshot("2026-01", "seca-fraca", "Seca fraca"),
      snapshot("2026-02", "seca-extrema", "Seca extrema"),
    ]), "Alfredo Chaves", presentation, "pt-BR");

    expect(text?.recent).toContain("Houve agravamento");
  });
});
