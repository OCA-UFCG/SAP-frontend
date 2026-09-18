import { describe, expect, it, vi } from "vitest";
import { resolveReportTerritory } from "@/utils/reportTerritory";

vi.mock("server-only", () => ({}));

const contentful = vi.hoisted(() => ({
  getCatalogEntry: vi.fn(),
  getLocalizedEntryField: vi.fn(),
}));
const reportService = vi.hoisted(() => ({ buildMunicipalReport: vi.fn() }));

vi.mock("@/services/indexCatalog/contentfulManagement", () => contentful);
vi.mock("@/services/municipalReportService", () => reportService);

import { buildIndexCatalogReportPreview } from "@/services/indexCatalog/reportPreviewService";
import type { MunicipalReportData } from "@/contracts/municipalReport";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";

const CAMPINA_GRANDE = "2504009";

/** As classes do Monitor de Secas que têm `rank` em `MUNICIPAL_REPORT_LAYERS`. */
const CLASSES = [
  { id: "sem-seca", label: "Sem seca", color: "#FFFFFF" },
  { id: "seca-fraca", label: "Seca fraca", color: "#FFEB3B" },
  { id: "seca-moderada", label: "Seca moderada", color: "#FFA000" },
];

function snapshot(period: string, dominantId: string) {
  const distribution = CLASSES.map((entry) => ({
    ...entry,
    percentage: entry.id === dominantId ? 80 : 10,
  }));
  return {
    period,
    label: period,
    distribution,
    dominantClass: distribution.find((entry) => entry.id === dominantId)!,
  };
}

function stubLegacyEntry() {
  contentful.getCatalogEntry.mockResolvedValue({
    entry: { sys: { id: "panel", version: 3 }, fields: {} },
    locale: "en-US",
    item: {
      entryId: "panel",
      published: true,
      catalogConfig: {
        schemaVersion: 2 as const,
        managedScope: "presentation" as const,
        panelLayerId: "anaseca",
        status: "published" as const,
        name: "Monitor de Secas",
        description: "Teste",
        category: "Dados Climáticos" as const,
        createdBy: { uid: "u", email: "e", at: "2026-01-01T00:00:00.000Z" },
        updatedBy: { uid: "u", email: "e", at: "2026-01-01T00:00:00.000Z" },
        auditLog: [],
      },
    },
  });
  contentful.getLocalizedEntryField.mockImplementation(
    (_entry: unknown, field: string) =>
      field === "imageData"
        ? ({
            schemaVersion: 1,
            type: "territorial-compact",
            classes: CLASSES,
            years: {
              "2023": { imageId: "img-2023", values: {} },
              "2024": { imageId: "img-2024", values: {} },
            },
          } as unknown as CompactTerritorialAnalysisDataset)
        : undefined,
  );

  const report: MunicipalReportData = {
    schemaVersion: 1,
    generatedAt: "2026-01-01T00:00:00.000Z",
    requestedPeriod: "2024",
    territory: resolveReportTerritory(CAMPINA_GRANDE)!,
    municipality: { code: CAMPINA_GRANDE, name: "Campina Grande", uf: "PB" },
    templateVariables: {},
    analyses: [
      {
        id: "anaseca",
        alias: "seca",
        title: "Monitor de Secas",
        unit: "%",
        valueType: "percentage",
        status: "available",
        requestedPeriod: "2024",
        effectivePeriod: "2024",
        classes: CLASSES,
        snapshot: snapshot("2024", "seca-moderada"),
        timeSeries: [
          snapshot("2023", "sem-seca"),
          snapshot("2024", "seca-moderada"),
        ],
      },
    ],
  };
  reportService.buildMunicipalReport.mockResolvedValue(report);
}

describe("buildIndexCatalogReportPreview > índice legado", () => {
  // Regressão: a tela resolvia a gravidade só pelo que o catálogo gravou, e um
  // legado não tem onde declará-la — então as variáveis de tendência ficavam
  // fora da lista mesmo o relatório sabendo preenchê-las pelos `rank`
  // estáticos de MUNICIPAL_REPORT_LAYERS.
  it("oferece as variáveis de tendência pela ordem de gravidade estática do legado", async () => {
    stubLegacyEntry();

    const preview = await buildIndexCatalogReportPreview("panel");
    const tokens = preview.variables.map(({ token }) => token);

    expect(tokens).toContain("[status_tendencia]");
    expect(tokens).toContain("[classe_maior_severidade]");
    // `sem-seca` é a classe neutra do Monitor de Secas, também estática.
    expect(tokens).toContain("[percentual_condicao_neutra]");
  });
});
