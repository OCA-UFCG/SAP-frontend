import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const contentful = vi.hoisted(() => ({
  getCatalogEntry: vi.fn(),
  getLocalizedEntryField: vi.fn(),
}));
const gee = vi.hoisted(() => ({ getGeeStatisticsYearPatch: vi.fn() }));

vi.mock("@/services/indexCatalog/contentfulManagement", () => contentful);
vi.mock("@/repositories/platform/geeStatisticsRepository", () => gee);

import { buildIndexCatalogReportPreview } from "@/services/indexCatalog/reportPreviewService";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";

const CAMPINA_GRANDE = "2504009";

const source = {
  schemaVersion: 1 as const,
  sourceRevision: "a".repeat(64),
  kind: "gee-feature-collection" as const,
  asset: { type: "fixed" as const, assetId: "projects/x/assets/stats" },
  periodGranularity: "year" as const,
  properties: {
    level: "NIVEL_AGRUPAMENTO",
    locationName: "NOME_LOCAL",
    municipalityCode: "CD_MUN",
    stateCode: "NM_UF",
    year: "ano",
    date: "data_img",
    totalArea: "area_total_ha",
  },
};

const imageData: CompactTerritorialAnalysisDataset = {
  schemaVersion: 1,
  type: "territorial-compact",
  classes: [
    { id: "arido", label: "Árido", color: "#795548" },
    { id: "semiarido", label: "Semiárido", color: "#c8b273" },
  ],
  years: {
    "2023": { imageId: "img-2023", values: {} },
    "2024": { imageId: "img-2024", values: {} },
  },
};

function stubDraft(report?: {
  sections: Array<{ title: string; text: string }>;
  sectionColor?: string;
  methodology?: string;
}) {
  const entry = { sys: { id: "panel", version: 3 }, fields: {} };
  contentful.getCatalogEntry.mockResolvedValue({
    entry,
    locale: "en-US",
    item: {
      entryId: "panel",
      published: false,
      catalogConfig: {
        schemaVersion: 2 as const,
        panelLayerId: "indice-de-aridez-catalogo",
        status: "ready" as const,
        name: "Índice de Aridez",
        description: "Teste",
        category: "Dados Climáticos" as const,
        statisticsSource: source,
        validatedStatisticsSource: source,
        classes: [
          {
            classIndex: 1,
            id: "arido",
            label: "Árido",
            color: "#795548",
            pixelValue: 1,
          },
          {
            classIndex: 2,
            id: "semiarido",
            label: "Semiárido",
            color: "#c8b273",
            pixelValue: 2,
          },
        ],
        earthEngine: {
          strategy: "single" as const,
          sourceType: "image" as const,
          singleAssetId: "projects/x/assets/map",
        },
        createdBy: { uid: "u", email: "e", at: "2026-01-01T00:00:00.000Z" },
        updatedBy: { uid: "u", email: "e", at: "2026-01-01T00:00:00.000Z" },
        validation: {
          validatedAt: "2026-01-01T00:00:00.000Z",
          valid: true,
          errors: [],
          warnings: [],
          inferred: {
            panelLayerId: "indice-de-aridez-catalogo",
            periods: ["2023", "2024"],
            defaultPeriod: "2024",
            timeScale: "Anual" as const,
            classIndexes: [1, 2],
            statisticsAssetCount: 1,
          },
          sourceFingerprint: "fingerprint",
        },
        auditLog: [],
        ...(report ? { report: { schemaVersion: 1 as const, ...report } } : {}),
      },
    },
  });
  contentful.getLocalizedEntryField.mockReturnValue(imageData);
}

/** Uma leitura do Earth Engine em que Campina Grande é 16,6% árida. */
function stubGeeRow() {
  gee.getGeeStatisticsYearPatch.mockResolvedValue({
    assetId: "projects/x/assets/stats",
    featureCount: 1,
    omittedZeroValueLocationKeys: [],
    metrics: {},
    patch: {
      years: { "2024": { values: { [CAMPINA_GRANDE]: [16.6, 83.4] } } },
    },
  });
}

describe("buildIndexCatalogReportPreview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("monta o relatório de Campina Grande no período mais recente", async () => {
    stubDraft();
    stubGeeRow();

    const preview = await buildIndexCatalogReportPreview("panel");

    expect(preview.municipality).toEqual({
      code: CAMPINA_GRANDE,
      name: "Campina Grande",
      uf: "PB",
    });
    expect(preview.period).toBe("2024");
    expect(preview.report.analyses[0]?.snapshot?.dominantClass?.label).toBe(
      "Semiárido",
    );
  });

  it("lê o Earth Engine uma vez, só para o período da prévia", async () => {
    stubDraft();
    stubGeeRow();

    await buildIndexCatalogReportPreview("panel");

    expect(gee.getGeeStatisticsYearPatch).toHaveBeenCalledTimes(1);
    expect(gee.getGeeStatisticsYearPatch).toHaveBeenCalledWith(
      "indice-de-aridez-catalogo",
      "2024",
      CAMPINA_GRANDE,
      2,
      source,
    );
  });

  it("troca as variáveis do texto do catálogo pelos dados do município", async () => {
    stubDraft({
      sections: [
        {
          title: "Situação atual",
          text: "Em [municipio] — [uf], predomina [classe] com [percentual]% em [periodo_extenso].",
        },
      ],
    });
    stubGeeRow();

    const preview = await buildIndexCatalogReportPreview("panel");

    expect(preview.docsContent["indice-de-aridez-catalogo"][0].text).toBe(
      "Em Campina Grande — PB, predomina Semiárido com 83,4% em 2024.",
    );
  });

  it("leva a cor e a nota escritas no catálogo para a prévia", async () => {
    stubDraft({
      sections: [],
      sectionColor: "#795548",
      methodology: "Razão entre precipitação e evapotranspiração.",
    });
    stubGeeRow();

    const preview = await buildIndexCatalogReportPreview("panel");

    expect(preview.report.analyses[0]?.presentation).toEqual({
      sectionColor: "#795548",
      methodology: "Razão entre precipitação e evapotranspiração.",
    });
  });

  it("marca a análise como indisponível quando o município não tem linha", async () => {
    stubDraft();
    gee.getGeeStatisticsYearPatch.mockResolvedValue(null);

    const preview = await buildIndexCatalogReportPreview("panel");

    expect(preview.report.analyses[0]?.status).toBe("unavailable");
  });

  it("não vai ao Earth Engine com um rascunho sem prévia validada", async () => {
    const entry = { sys: { id: "panel", version: 1 }, fields: {} };
    contentful.getCatalogEntry.mockResolvedValue({
      entry,
      locale: "en-US",
      item: {
        entryId: "panel",
        published: false,
        catalogConfig: {
          schemaVersion: 2 as const,
          panelLayerId: "sem-previa",
          status: "draft" as const,
          name: "Sem prévia",
          description: "Teste",
          category: "Dados Climáticos" as const,
          statisticsSource: source,
          classes: [],
          earthEngine: {
            strategy: "single" as const,
            sourceType: "image" as const,
            singleAssetId: "projects/x/assets/map",
          },
          createdBy: { uid: "u", email: "e", at: "2026-01-01T00:00:00.000Z" },
          updatedBy: { uid: "u", email: "e", at: "2026-01-01T00:00:00.000Z" },
          auditLog: [],
        },
      },
    });

    await expect(buildIndexCatalogReportPreview("panel")).rejects.toThrow(
      /Valide os assets/u,
    );
    expect(gee.getGeeStatisticsYearPatch).not.toHaveBeenCalled();
  });
});
