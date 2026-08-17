import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const contentful = vi.hoisted(() => ({
  getCatalogEntry: vi.fn(),
  getManagementEntry: vi.fn(),
  getLocalizedEntryField: vi.fn(),
  patchManagementEntry: vi.fn(),
  publishManagementEntry: vi.fn(),
  unpublishManagementEntry: vi.fn(),
  deleteManagementEntry: vi.fn(),
}));
const buildCatalogDraft = vi.hoisted(() => vi.fn());

vi.mock("@/services/indexCatalog/contentfulManagement", () => ({
  ...contentful,
  createPanelLayerDraft: vi.fn(),
  ensureIndexCatalogContentModel: vi.fn(),
  listCatalogEntries: vi.fn(),
}));
vi.mock("@/services/indexCatalog/catalogBuild", () => ({
  buildCatalogDraft,
  getCatalogBuildValidation: vi.fn(),
}));
vi.mock("@/repositories/platform/geeStatisticsRepository", () => ({
  getGeeStatisticsYearPatch: vi.fn(),
}));

import {
  deleteIndexCatalogEntry,
  getIndexCatalogLifecycleImpact,
  publishIndexCatalogDraft,
  publishIndexCatalogEntry,
  unpublishIndexCatalogEntry,
} from "@/services/indexCatalog/indexCatalogService";

const user = { uid: "admin-1", email: "oca-dev@gmail.com" };
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
const validation = {
  validatedAt: "2026-08-17T12:00:00.000Z",
  valid: true,
  errors: [],
  warnings: [],
  inferred: {
    panelLayerId: "seca",
    periods: ["2025"],
    defaultPeriod: "2025",
    timeScale: "Anual" as const,
    classIndexes: [1],
    statisticsAssetCount: 1,
  },
  sourceFingerprint: "fingerprint",
};
const config = {
  schemaVersion: 2 as const,
  panelLayerId: "seca",
  status: "ready" as const,
  name: "Seca",
  description: "Teste",
  category: "Dados Climáticos" as const,
  statisticsSource: source,
  validatedStatisticsSource: source,
  classes: [
    {
      classIndex: 1,
      id: "seca",
      label: "Seca",
      color: "#989F43",
      pixelValue: 1,
    },
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

function managementEntry(id: string, published = false, version = 1) {
  return {
    sys: {
      id,
      version,
      ...(published ? { publishedAt: "2026-08-17T10:00:00Z" } : {}),
    },
    fields: {},
  };
}

function currentEntry(options: { published?: boolean; legacy?: boolean } = {}) {
  const entry = managementEntry("panel", Boolean(options.published), 7);
  return {
    locale: "en-US",
    entry,
    item: {
      entryId: "panel",
      panelLayerId: "seca",
      name: "Seca",
      description: "Teste",
      published: Boolean(options.published),
      hasUnpublishedChanges: false,
      catalogManaged: !options.legacy,
      status: options.legacy ? "legacy" : "ready",
      ...(options.legacy ? {} : { catalogConfig: config }),
    },
  };
}

describe("index catalog v2 lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports that only panelLayer is managed", async () => {
    contentful.getCatalogEntry.mockResolvedValue(currentEntry());
    await expect(getIndexCatalogLifecycleImpact("panel")).resolves.toEqual(
      expect.objectContaining({
        linkedEntries: [],
        counts: {
          panelLayer: 1,
          municipalAnalysis: 0,
          municipalReportSeries: 0,
          total: 1,
        },
      }),
    );
  });

  it("publishes one panelLayer and no derived Contentful entries", async () => {
    const current = currentEntry();
    contentful.getCatalogEntry.mockResolvedValue(current);
    contentful.getManagementEntry.mockResolvedValue(current.entry);
    contentful.patchManagementEntry.mockResolvedValue(
      managementEntry("panel", false, 8),
    );
    contentful.publishManagementEntry.mockResolvedValue(
      managementEntry("panel", true, 9),
    );
    buildCatalogDraft.mockResolvedValue({
      panelLayerImageData: { years: {} },
      validation,
      statisticsSource: source,
      classes: config.classes,
      mapVisualization: {},
    });

    await expect(publishIndexCatalogDraft("panel", user)).resolves.toEqual({
      entryId: "panel",
      panelLayerId: "seca",
      status: "published",
    });
    expect(contentful.patchManagementEntry).toHaveBeenCalledWith(
      current.entry,
      expect.objectContaining({
        imageData: { years: {} },
        statisticsSource: source,
      }),
    );
    expect(contentful.publishManagementEntry).toHaveBeenCalledTimes(1);
  });

  it("allows unpublishing v2 and refuses lifecycle mutations for legacy", async () => {
    const current = currentEntry({ published: true });
    contentful.getCatalogEntry.mockResolvedValueOnce(current);
    contentful.patchManagementEntry.mockResolvedValue(
      managementEntry("panel", true, 8),
    );
    await expect(unpublishIndexCatalogEntry("panel", user)).resolves.toEqual(
      expect.objectContaining({ status: "ready" }),
    );
    expect(contentful.unpublishManagementEntry).toHaveBeenCalledTimes(1);

    contentful.getCatalogEntry.mockResolvedValueOnce(
      currentEntry({ legacy: true }),
    );
    await expect(publishIndexCatalogEntry("panel", user)).rejects.toThrow(
      "apenas para consulta",
    );
  });

  it("deletes only the confirmed v2 panelLayer", async () => {
    const current = currentEntry({ published: true });
    contentful.getCatalogEntry.mockResolvedValue(current);
    await expect(
      deleteIndexCatalogEntry("panel", "outro", user),
    ).rejects.toThrow("ID técnico");
    expect(contentful.deleteManagementEntry).not.toHaveBeenCalled();

    contentful.unpublishManagementEntry.mockResolvedValue(
      managementEntry("panel", false, 8),
    );
    contentful.getManagementEntry.mockResolvedValue(
      managementEntry("panel", false, 8),
    );
    await expect(
      deleteIndexCatalogEntry("panel", "seca", user),
    ).resolves.toEqual(expect.objectContaining({ deletedEntries: 1 }));
    expect(contentful.deleteManagementEntry).toHaveBeenCalledTimes(1);
  });
});
