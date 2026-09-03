import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const panelLayersFixture: Array<Record<string, unknown>> = [{
  id: "cdi",
  reportSeriesConfig: { datasetVersion: "v1" },
}];

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(async () => panelLayersFixture),
}));
vi.mock("@/services/municipalReportService", () => ({
  buildMunicipalReport: vi.fn(async (municipalityCode: string, requestedPeriod: string) => ({
    schemaVersion: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    requestedPeriod,
    municipality: { code: municipalityCode, name: "Teste", uf: "GO" },
    analyses: [],
    templateVariables: {},
  })),
}));

import {
  buildCachedMunicipalReport,
  clearMunicipalReportCache,
} from "@/services/municipalReportCache";
import { buildMunicipalReport } from "@/services/municipalReportService";

describe("municipal report cache", () => {
  beforeEach(() => {
    clearMunicipalReportCache();
    vi.clearAllMocks();
    panelLayersFixture.length = 0;
    panelLayersFixture.push({
      id: "cdi",
      reportSeriesConfig: { datasetVersion: "v1" },
    });
  });

  it("deduplicates report assembly by municipality, period, layers and dataset version", async () => {
    const [first, second] = await Promise.all([
      buildCachedMunicipalReport("5200050", "2024", { analysisIds: ["cdi"] }),
      buildCachedMunicipalReport("5200050", "2024", { analysisIds: ["cdi"] }),
    ]);
    expect(first).toBe(second);
    expect(buildMunicipalReport).toHaveBeenCalledTimes(1);
  });

  it("does not share entries between different layer selections", async () => {
    await buildCachedMunicipalReport("5200050", "2024", { analysisIds: ["cdi"] });
    await buildCachedMunicipalReport("5200050", "2024", { analysisIds: ["seca"] });
    expect(buildMunicipalReport).toHaveBeenCalledTimes(2);
  });

  it("does not share entries between different checkbox orders", async () => {
    await buildCachedMunicipalReport("5200050", "2024", {
      analysisIds: ["cdi", "seca"],
    });
    await buildCachedMunicipalReport("5200050", "2024", {
      analysisIds: ["seca", "cdi"],
    });

    expect(buildMunicipalReport).toHaveBeenCalledTimes(2);
  });

  // Regressão: um índice publicado pelo catálogo não tem `reportSeriesConfig`,
  // então a chave dele era a constante "<id>@legacy" e republicar com outras
  // classes ou outra tabela estatística devolvia o relatório anterior por até
  // dez minutos.
  it("invalida o relatório quando a revisão da fonte estatística muda", async () => {
    panelLayersFixture.length = 0;
    panelLayersFixture.push({
      id: "indice-catalogo",
      statisticsSource: { schemaVersion: 1, sourceRevision: "rev-1" },
    });
    await buildCachedMunicipalReport("5200050", "2024", {
      analysisIds: ["indice-catalogo"],
    });

    panelLayersFixture[0] = {
      id: "indice-catalogo",
      statisticsSource: { schemaVersion: 1, sourceRevision: "rev-2" },
    };
    await buildCachedMunicipalReport("5200050", "2024", {
      analysisIds: ["indice-catalogo"],
    });

    expect(buildMunicipalReport).toHaveBeenCalledTimes(2);
  });

  it("reaproveita o relatório enquanto a revisão da fonte estatística for a mesma", async () => {
    panelLayersFixture.length = 0;
    panelLayersFixture.push({
      id: "indice-catalogo",
      statisticsSource: { schemaVersion: 1, sourceRevision: "rev-1" },
    });

    await buildCachedMunicipalReport("5200050", "2024", {
      analysisIds: ["indice-catalogo"],
    });
    await buildCachedMunicipalReport("5200050", "2024", {
      analysisIds: ["indice-catalogo"],
    });

    expect(buildMunicipalReport).toHaveBeenCalledTimes(1);
  });
});
