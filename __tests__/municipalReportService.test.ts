import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildMunicipalReport } from "@/services/municipalReportService";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";

const imageData: CompactTerritorialAnalysisDataset = {
  schemaVersion: 1, type: "territorial-compact",
  classes: [{ id: "seca", label: "Seca", color: "#f00" }],
  years: { "2024": { imageId: "x", values: { "5200050": [100] } } },
};

describe("buildMunicipalReport", () => {
  it("keeps configured order, partial failures and stable template variables", async () => {
    const report = await buildMunicipalReport("5200050", "2024", {
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      layers: [
        { panelLayerId: "missing", alias: "missing", title: "Missing", order: 20 },
        { panelLayerId: "seca", alias: "seca", title: "Seca", order: 10 },
      ],
      loadImageData: async (id) => ({ found: id === "seca", imageData: id === "seca" ? imageData : null, status: "miss" }),
    });
    expect(report.analyses.map((item) => item.id)).toEqual(["seca", "missing"]);
    expect(report.analyses.map((item) => item.status)).toEqual(["available", "unavailable"]);
    expect(report.templateVariables).toMatchObject({ municipio: "Abadia de Goiás", uf: "GO", classe_seca: "Seca", percentual_seca: 100 });
  });

  it("marks a missing requested period while retaining history", async () => {
    const report = await buildMunicipalReport("5200050", "2023", {
      layers: [{ panelLayerId: "seca", alias: "seca", title: "Seca", order: 1 }],
      loadImageData: async () => ({ found: true, imageData, status: "hit" }),
    });
    expect(report.analyses[0]).toMatchObject({ status: "period_not_found", effectivePeriod: null });
    expect(report.analyses[0]?.timeSeries).toHaveLength(1);
  });
});
