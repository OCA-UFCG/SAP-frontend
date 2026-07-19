import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(async () => [{
    id: "cdi",
    reportSeriesConfig: { datasetVersion: "v1" },
  }]),
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
});
