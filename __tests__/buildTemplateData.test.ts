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
  it("builds the drought history narratives with report-ready formatting", () => {
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

    expect(templateData.texto_tendencia_recente_seca).toBe(
      "A série histórica de Monitor de seca | ANA registra que Campina Grande apresentou condição de seca em 12 dos últimos 12 períodos analisados (maio de 2025 a abril de 2026). No período de referência (abril de 2026), predomina Seca moderada (D1). Houve redução em relação ao mês anterior, quando predominava Seca grave (D2).",
    );
    expect(templateData.texto_contexto_historico_seca).toBe(
      "No período janeiro de 2024–abril de 2026, a classe predominante mais frequente foi Seca fraca (D0), em 32,1% dos períodos. A condição sem seca predominou em 21,4% do período. A maior severidade observada foi Seca extrema (D3), registrada em dezembro de 2025.",
    );
  });
});
