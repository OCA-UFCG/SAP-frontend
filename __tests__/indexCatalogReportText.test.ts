import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const contentful = vi.hoisted(() => ({
  ensureIndexCatalogContentModel: vi.fn(),
  getCatalogEntry: vi.fn(),
  getManagementEntry: vi.fn(),
  patchManagementEntry: vi.fn(),
}));

vi.mock("@/services/indexCatalog/contentfulManagement", () => contentful);

import { saveIndexCatalogReportText } from "@/services/indexCatalog/reportTextService";

const user = { uid: "admin-1", email: "oca-dev@gmail.com" };
const validation = {
  validatedAt: "2026-08-17T12:00:00.000Z",
  valid: true,
  errors: [],
  warnings: [],
  inferred: {
    panelLayerId: "aridez-catalogo",
    periods: ["2025"],
    defaultPeriod: "2025",
    timeScale: "Anual" as const,
    classIndexes: [1],
    statisticsAssetCount: 1,
  },
  sourceFingerprint: "fingerprint-original",
};
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
const readyConfig = {
  schemaVersion: 2 as const,
  panelLayerId: "aridez-catalogo",
  status: "ready" as const,
  name: "Aridez",
  description: "Teste",
  category: "Dados Climáticos" as const,
  statisticsSource: source,
  validatedStatisticsSource: source,
  classes: [
    { classIndex: 1, id: "arido", label: "Árido", color: "#795548", pixelValue: 1 },
  ],
  earthEngine: {
    strategy: "single" as const,
    sourceType: "image" as const,
    singleAssetId: "projects/x/assets/map",
  },
  createdBy: { ...user, at: "2026-08-17T10:00:00.000Z" },
  updatedBy: { ...user, at: "2026-08-17T12:00:00.000Z" },
  validation,
  auditLog: [],
};

function stubEntry(options: { published?: boolean; legacy?: boolean } = {}) {
  const entry = { sys: { id: "panel", version: 7 }, fields: {} };
  contentful.getCatalogEntry.mockResolvedValue({
    entry,
    locale: "en-US",
    item: {
      entryId: "panel",
      published: Boolean(options.published),
      catalogConfig: options.legacy
        ? { schemaVersion: 1, panelLayerId: "legado", status: "published" }
        : readyConfig,
    },
  });
  contentful.getManagementEntry.mockResolvedValue(entry);
  contentful.patchManagementEntry.mockResolvedValue(entry);
}

const validReport = {
  schemaVersion: 1,
  sectionColor: "#795548",
  methodology: "Razão entre precipitação e evapotranspiração.",
  sections: [{ title: "Situação atual", text: "O município está em [classe]." }],
};

function patchedFields() {
  return contentful.patchManagementEntry.mock.calls[0][1] as Record<
    string,
    Record<string, unknown> | undefined
  >;
}

describe("saveIndexCatalogReportText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentful.ensureIndexCatalogContentModel.mockResolvedValue({
      changed: false,
    });
  });

  it("grava o texto no campo reportConfig do panelLayer", async () => {
    stubEntry();

    const result = await saveIndexCatalogReportText("panel", validReport, user);

    expect(patchedFields().reportConfig).toEqual({
      schemaVersion: 1,
      sectionColor: "#795548",
      methodology: "Razão entre precipitação e evapotranspiração.",
      sections: [
        { title: "Situação atual", text: "O município está em [classe]." },
      ],
    });
    expect(result.sectionCount).toBe(1);
  });

  it("preserva a prévia validada: não zera status nem validation", async () => {
    stubEntry();

    await saveIndexCatalogReportText("panel", validReport, user);

    const config = patchedFields().catalogConfig as typeof readyConfig;
    expect(config.status).toBe("ready");
    expect(config.validation).toEqual(validation);
    expect(config.validatedStatisticsSource).toEqual(source);
  });

  it("registra a escrita no histórico de auditoria", async () => {
    stubEntry();

    await saveIndexCatalogReportText("panel", validReport, user);

    const config = patchedFields().catalogConfig as typeof readyConfig;
    expect(config.auditLog?.at(-1)).toMatchObject({
      action: "report-text",
      outcome: "success",
      uid: "admin-1",
    });
  });

  it("apaga o campo quando o texto fica vazio, devolvendo o índice ao Google Docs", async () => {
    stubEntry();

    await saveIndexCatalogReportText(
      "panel",
      { schemaVersion: 1, sections: [] },
      user,
    );

    expect(patchedFields().reportConfig).toBeUndefined();
  });

  it("cria o campo no content type antes de escrever", async () => {
    stubEntry();

    await saveIndexCatalogReportText("panel", validReport, user);

    expect(contentful.ensureIndexCatalogContentModel).toHaveBeenCalledOnce();
  });

  it("avisa que uma entry publicada precisa ser republicada", async () => {
    stubEntry({ published: true });

    const result = await saveIndexCatalogReportText("panel", validReport, user);

    expect(result.requiresRepublish).toBe(true);
  });

  it("recusa um texto malformado sem tocar no Contentful", async () => {
    stubEntry();

    await expect(
      saveIndexCatalogReportText(
        "panel",
        { schemaVersion: 1, sections: [{ text: "sem título" }] },
        user,
      ),
    ).rejects.toThrow(/precisa de um título/u);
    expect(contentful.patchManagementEntry).not.toHaveBeenCalled();
  });

  it("recusa um índice que o catálogo não adotou", async () => {
    stubEntry({ legacy: true });

    await expect(
      saveIndexCatalogReportText("panel", validReport, user),
    ).rejects.toThrow(/não foi adotado/u);
  });
});
