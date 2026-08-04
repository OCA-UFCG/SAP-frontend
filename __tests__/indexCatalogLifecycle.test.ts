import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const contentful = vi.hoisted(() => ({
  getCatalogEntry: vi.fn(),
  getManagementEntry: vi.fn(),
  getLocalizedEntryField: vi.fn(
    (
      entry: { fields: Record<string, Record<string, unknown>> },
      field: string,
      locale: string,
    ) => entry.fields[field]?.[locale],
  ),
  listMunicipalAnalysisEntries: vi.fn(),
  listMunicipalReportSeriesEntries: vi.fn(),
  patchManagementEntry: vi.fn(),
  publishManagementEntry: vi.fn(),
  unpublishManagementEntry: vi.fn(),
  deleteManagementEntry: vi.fn(),
}));

vi.mock("@/services/indexCatalog/contentfulManagement", () => ({
  ...contentful,
  createMunicipalAnalysisDraft: vi.fn(),
  createPanelLayerDraft: vi.fn(),
  ensureIndexCatalogContentModel: vi.fn(),
  getContentfulDefaultLocale: vi.fn(),
  listCatalogEntries: vi.fn(),
}));

vi.mock("@/services/indexCatalog/catalogBuild", () => ({
  buildCatalogDraft: vi.fn(),
  getCatalogBuildValidation: vi.fn(),
}));

vi.mock("@/repositories/platform/municipalAnalysisRepository", () => ({
  toDatasetPatch: vi.fn(),
}));

import {
  deleteIndexCatalogEntry,
  getIndexCatalogLifecycleImpact,
  publishIndexCatalogEntry,
  unpublishIndexCatalogEntry,
} from "@/services/indexCatalog/indexCatalogService";

const user = {
  uid: "admin-1",
  email: "oca-dev@gmail.com",
};

function managementEntry(
  id: string,
  options: { published?: boolean; title?: string; version?: number } = {},
) {
  return {
    sys: {
      id,
      version: options.version ?? 1,
      ...(options.published ? { publishedAt: "2026-07-30T10:00:00Z" } : {}),
    },
    fields: {
      ...(options.title ? { title: { "en-US": options.title } } : {}),
    },
  };
}

describe("index catalog lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentful.listMunicipalAnalysisEntries.mockResolvedValue([]);
    contentful.listMunicipalReportSeriesEntries.mockResolvedValue([]);
  });

  it("reports every linked Contentful entry before deletion", async () => {
    contentful.getCatalogEntry.mockResolvedValue({
      locale: "en-US",
      entry: managementEntry("panel"),
      item: {
        entryId: "panel",
        panelLayerId: "seca",
        name: "Seca",
        description: "",
        published: true,
        hasUnpublishedChanges: false,
        catalogManaged: false,
        status: "legacy",
      },
    });
    contentful.listMunicipalAnalysisEntries.mockResolvedValue([
      managementEntry("municipal-1", {
        title: "Municipal Seca 2025",
        published: true,
      }),
    ]);
    contentful.listMunicipalReportSeriesEntries.mockResolvedValue([
      managementEntry("series-1", { title: "Série Seca" }),
      managementEntry("series-2", { title: "Série Seca 2" }),
    ]);

    const impact = await getIndexCatalogLifecycleImpact("panel");

    expect(impact.counts).toEqual({
      panelLayer: 1,
      municipalAnalysis: 1,
      municipalReportSeries: 2,
      total: 4,
    });
    expect(impact.linkedEntries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entryId: "municipal-1",
          contentType: "municipalAnalysis",
          published: true,
        }),
        expect.objectContaining({
          entryId: "series-1",
          contentType: "municipalReportSeries",
          published: false,
        }),
      ]),
    );
  });

  it("moves a managed published index to a validated draft", async () => {
    const entry = managementEntry("panel", { published: true, version: 7 });
    const config = {
      schemaVersion: 1,
      panelLayerId: "seca",
      status: "published",
      validation: { valid: true },
      derivedEntryIds: ["municipal-1"],
      auditLog: [],
    };
    contentful.getCatalogEntry.mockResolvedValue({
      locale: "en-US",
      entry,
      item: {
        entryId: "panel",
        panelLayerId: "seca",
        name: "Seca",
        description: "",
        published: true,
        hasUnpublishedChanges: false,
        catalogManaged: true,
        status: "published",
        catalogConfig: config,
      },
    });
    const patched = managementEntry("panel", {
      published: true,
      version: 8,
    });
    contentful.patchManagementEntry.mockResolvedValue(patched);
    contentful.unpublishManagementEntry.mockResolvedValue(patched);

    const result = await unpublishIndexCatalogEntry("panel", user);

    expect(result.status).toBe("ready");
    expect(contentful.patchManagementEntry).toHaveBeenCalledWith(
      entry,
      expect.objectContaining({
        catalogConfig: expect.objectContaining({
          status: "ready",
          auditLog: [
            expect.objectContaining({
              action: "unpublish",
              outcome: "success",
              email: "oca-dev@gmail.com",
            }),
          ],
        }),
      }),
    );
    expect(contentful.unpublishManagementEntry).toHaveBeenCalledWith(patched);
  });

  it("publishes a legacy draft directly", async () => {
    const entry = managementEntry("panel");
    contentful.getCatalogEntry.mockResolvedValue({
      locale: "en-US",
      entry,
      item: {
        entryId: "panel",
        panelLayerId: "seca",
        name: "Seca",
        description: "",
        published: false,
        hasUnpublishedChanges: false,
        catalogManaged: false,
        status: "legacy",
      },
    });
    contentful.publishManagementEntry.mockResolvedValue(
      managementEntry("panel", { published: true, version: 2 }),
    );

    await expect(publishIndexCatalogEntry("panel", user)).resolves.toEqual({
      entryId: "panel",
      panelLayerId: "seca",
      status: "published",
    });
    expect(contentful.publishManagementEntry).toHaveBeenCalledWith(entry);
  });

  it("does not mutate Contentful when deletion confirmation is wrong", async () => {
    contentful.getCatalogEntry.mockResolvedValue({
      locale: "en-US",
      entry: managementEntry("panel", { published: true }),
      item: {
        entryId: "panel",
        panelLayerId: "seca",
        name: "Seca",
        description: "",
        published: true,
        hasUnpublishedChanges: false,
        catalogManaged: false,
        status: "legacy",
      },
    });

    await expect(
      deleteIndexCatalogEntry("panel", "outro-id", user),
    ).rejects.toThrow("ID técnico");
    expect(contentful.unpublishManagementEntry).not.toHaveBeenCalled();
    expect(contentful.deleteManagementEntry).not.toHaveBeenCalled();
  });
});
