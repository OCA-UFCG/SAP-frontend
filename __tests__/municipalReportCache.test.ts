import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const panelLayersFixture: Array<Record<string, unknown>> = [
  {
    id: "cdi",
    reportSeriesConfig: { datasetVersion: "v1" },
  },
];

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(async () => panelLayersFixture),
}));
vi.mock("@/services/municipalReportService", () => ({
  buildMunicipalReport: vi.fn(
    async (municipalityCode: string, requestedPeriod: string) => ({
      schemaVersion: 1,
      generatedAt: "2026-01-01T00:00:00.000Z",
      requestedPeriod,
      municipality: { code: municipalityCode, name: "Teste", uf: "GO" },
      analyses: [],
      templateVariables: {},
    }),
  ),
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
    await buildCachedMunicipalReport("5200050", "2024", {
      analysisIds: ["cdi"],
    });
    await buildCachedMunicipalReport("5200050", "2024", {
      analysisIds: ["seca"],
    });
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

  // Regressão de desempenho: o teto eram dez relatórios, e cada expulsão custa
  // a remontagem inteira — ~18 s num município com todas as camadas.
  describe("teto de entradas", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    async function buildReports(count: number) {
      for (let index = 0; index < count; index += 1) {
        await buildCachedMunicipalReport(`520005${index}`, "2024", {
          analysisIds: ["cdi"],
        });
      }
    }

    it("mantém em cache mais relatórios do que os dez de antes", async () => {
      await buildReports(11);
      vi.mocked(buildMunicipalReport).mockClear();

      await buildCachedMunicipalReport("5200050", "2024", {
        analysisIds: ["cdi"],
      });

      expect(buildMunicipalReport).not.toHaveBeenCalled();
    });

    it("expulsa o relatório menos recentemente usado quando o teto estoura", async () => {
      vi.stubEnv("MUNICIPAL_REPORT_CACHE_MAX_ENTRIES", "2");
      await buildReports(2);
      // Relê o primeiro para que o segundo passe a ser o mais antigo.
      await buildCachedMunicipalReport("5200050", "2024", {
        analysisIds: ["cdi"],
      });

      await buildCachedMunicipalReport("5200052", "2024", {
        analysisIds: ["cdi"],
      });
      vi.mocked(buildMunicipalReport).mockClear();

      await buildCachedMunicipalReport("5200050", "2024", {
        analysisIds: ["cdi"],
      });
      await buildCachedMunicipalReport("5200051", "2024", {
        analysisIds: ["cdi"],
      });

      expect(buildMunicipalReport).toHaveBeenCalledTimes(1);
      expect(buildMunicipalReport).toHaveBeenCalledWith(
        "5200051",
        "2024",
        expect.anything(),
      );
    });
  });
});
