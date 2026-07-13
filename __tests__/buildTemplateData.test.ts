import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { prepareTemplateData } from "@/services/buildDoc/buildTemplateData";
import type {
  MunicipalReportData,
  MunicipalReportDistributionItem,
  MunicipalReportPeriodSnapshot,
} from "@/contracts/municipalReport";

function droughtSnapshot(period: string, id: string, label: string): MunicipalReportPeriodSnapshot {
  const dominantClass: MunicipalReportDistributionItem = {
    id,
    label,
    color: "#ffffff",
    percentage: 100,
  };

  return {
    period,
    label: period,
    distribution: [dominantClass],
    dominantClass,
  };
}

function buildReport(timeSeries: MunicipalReportPeriodSnapshot[]): MunicipalReportData {
  return {
    schemaVersion: 1,
    generatedAt: "2026-07-11T00:00:00.000Z",
    requestedPeriod: "2026",
    municipality: { code: "2504009", name: "Campina Grande", uf: "PB" },
    analyses: [
      {
        id: "anaseca",
        alias: "seca",
        title: "Monitor de Secas",
        unit: "%",
        status: "available",
        requestedPeriod: "2026",
        effectivePeriod: "2026-04",
        classes: [],
        snapshot: timeSeries.at(-1) ?? null,
        timeSeries,
      },
    ],
    templateVariables: {},
  };
}

describe("prepareTemplateData", () => {
  it("does not use snapshots after the report effective period", () => {
    const timeSeries = [
      droughtSnapshot("2025-01", "sem-seca", "Sem seca"),
      droughtSnapshot("2025-02", "seca-fraca", "Seca fraca"),
      droughtSnapshot("2025-03", "seca-extrema", "Seca extrema"),
    ];
    const report = buildReport(timeSeries);
    report.requestedPeriod = "2025-02";
    report.analyses[0].requestedPeriod = "2025-02";
    report.analyses[0].effectivePeriod = "2025-02";
    report.analyses[0].snapshot = timeSeries[1];

    const templateData = prepareTemplateData(report);

    expect(templateData.periodo_seca).toBe("fevereiro de 2025");
    expect(templateData.classe_seca).toBe("Seca fraca (D0)");
    expect(templateData.periodos_seca_maxima).not.toContain("março de 2025");
  });

  it("only exposes values backed by the report data", () => {
    const timeSeries = [
      "2024-01", "2024-02", "2024-03", "2024-04", "2024-05", "2024-06",
    ].map((period) => droughtSnapshot(period, "sem-seca", "Sem seca"));

    timeSeries.push(...[
      "2024-07", "2024-08", "2024-09", "2024-10", "2024-11", "2024-12",
      "2025-01", "2025-02", "2025-03",
    ].map((period) => droughtSnapshot(period, "seca-fraca", "Seca fraca")));

    timeSeries.push(droughtSnapshot("2025-04", "seca-moderada", "Seca moderada"));
    timeSeries.push(...[
      "2025-05", "2025-06",
    ].map((period) => droughtSnapshot(period, "seca-moderada", "Seca moderada")));
    timeSeries.push(...[
      "2025-07", "2025-08", "2025-09", "2025-10", "2025-11",
    ].map((period) => droughtSnapshot(period, "seca-grave", "Seca grave")));
    timeSeries.push(droughtSnapshot("2025-12", "seca-extrema", "Seca extrema"));
    timeSeries.push(droughtSnapshot("2026-01", "seca-grave", "Seca grave"));
    timeSeries.push(droughtSnapshot("2026-02", "seca-grave", "Seca grave"));
    timeSeries.push(droughtSnapshot("2026-03", "seca-grave", "Seca grave"));
    timeSeries.push(droughtSnapshot("2026-04", "seca-moderada", "Seca moderada"));

    const templateData = prepareTemplateData(buildReport(timeSeries));

    expect(templateData.valor_ia_medio).toBeUndefined();
    expect(templateData.texto_tendencia_recente_seca).toBeUndefined();
    expect(templateData.texto_contexto_historico_seca).toBeUndefined();
  });
});
