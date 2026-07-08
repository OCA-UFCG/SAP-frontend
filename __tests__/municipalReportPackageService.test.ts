import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildMunicipalReportPackage } from "@/services/municipalReportPackageService";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";

const imageData: CompactTerritorialAnalysisDataset = {
  schemaVersion: 1, type: "territorial-compact",
  classes: [{ id: "seca", label: "Seca", color: "#f00" }],
  years: { "2024": { imageId: "x", values: { "5200050": [100] } } },
};

describe("municipal report package", () => {
  it("accepts a provider-compatible document and excludes unselected analyses", async () => {
    const reportPackage = await buildMunicipalReportPackage("5200050", "2024", ["seca"], {
      layers: [
        { panelLayerId: "seca", alias: "seca", title: "Seca", order: 1 },
        { panelLayerId: "aridez", alias: "aridez", title: "Aridez", order: 2 },
      ],
      loadImageData: async () => ({ found: true, imageData, status: "hit" }),
      templateProvider: {
        getTemplate: async () => ({
          id: "google-doc", version: "revision-1", origin: "google-docs", updatedAt: "2026-07-07T00:00:00.000Z",
          text: "[[analysis:seca:situation]]\n$municipio\n[[analysis:aridez:situation]]\n$municipio",
        }),
      },
    });
    expect(reportPackage.content.template.origin).toBe("google-docs");
    expect(reportPackage.content.sections.map(({ key }) => key)).toEqual(["analysis:seca:situation"]);
  });
});
