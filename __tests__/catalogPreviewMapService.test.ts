import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getCatalogEntry: vi.fn(),
  getManagementEntry: vi.fn(),
  patchManagementEntry: vi.fn(),
  getContentfulAsset: vi.fn(),
  saveContentfulAsset: vi.fn(),
}));

vi.mock("@/services/indexCatalog/contentfulManagement", () => ({
  getCatalogEntry: mocks.getCatalogEntry,
  getManagementEntry: mocks.getManagementEntry,
  patchManagementEntry: mocks.patchManagementEntry,
  getLocalizedEntryField: (
    entry: { fields: Record<string, Record<string, unknown> | undefined> },
    fieldId: string,
    locale: string,
  ) => entry.fields[fieldId]?.[locale],
}));

vi.mock("@/services/indexCatalog/contentfulAssets", () => ({
  getContentfulAsset: mocks.getContentfulAsset,
  getAssetFileUrl: (
    asset: { fields: { file?: Record<string, { url?: string }> } },
    locale: string,
  ) => asset.fields.file?.[locale]?.url ?? null,
  saveContentfulAsset: mocks.saveContentfulAsset,
}));

import {
  getIndexCatalogPreviewMapUrl,
  saveIndexCatalogPreviewMap,
} from "@/services/indexCatalog/previewMapService";
import type { IndexCatalogConfigV2 } from "@/types/indexCatalog";

const PNG_DATA_URL = `data:image/png;base64,${Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02,
]).toString("base64")}`;

const config = {
  schemaVersion: 2,
  panelLayerId: "indice-aridez",
  status: "ready",
  name: "Índice de Aridez",
  auditLog: [],
} as unknown as IndexCatalogConfigV2;

const user = { uid: "admin", email: "admin@example.test" };

function catalogEntry(published: boolean, catalogConfig: unknown = config) {
  return {
    entry: { sys: { id: "entry-1", version: 4 }, fields: {} },
    locale: "en-US",
    item: { entryId: "entry-1", published, catalogConfig },
  };
}

describe("saveIndexCatalogPreviewMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.saveContentfulAsset.mockResolvedValue({
      assetId: "asset-1",
      url: "https://images.ctfassets.net/space/asset/previa.png",
    });
    mocks.getManagementEntry.mockResolvedValue({
      sys: { id: "entry-1", version: 4 },
      fields: {},
    });
    mocks.patchManagementEntry.mockResolvedValue({
      sys: { id: "entry-1", version: 5 },
      fields: {},
    });
  });

  it("links the published asset to the panelLayer and records the audit event", async () => {
    mocks.getCatalogEntry.mockResolvedValue(catalogEntry(false));

    const result = await saveIndexCatalogPreviewMap(
      "entry-1",
      PNG_DATA_URL,
      user,
    );

    expect(result).toEqual({
      entryId: "entry-1",
      panelLayerId: "indice-aridez",
      assetId: "asset-1",
      url: "https://images.ctfassets.net/space/asset/previa.png",
      requiresRepublish: false,
    });
    expect(mocks.saveContentfulAsset).toHaveBeenCalledWith(
      expect.objectContaining({
        assetId: undefined,
        contentType: "image/png",
        fileName: "indice-aridez-previa-mapa.png",
        locale: "en-US",
        title: "Prévia do mapa — Índice de Aridez",
      }),
    );

    const [, patchedFields] = mocks.patchManagementEntry.mock.calls[0];
    expect(patchedFields.previewMap).toEqual({
      sys: { type: "Link", linkType: "Asset", id: "asset-1" },
    });
    const patchedConfig = patchedFields.catalogConfig as IndexCatalogConfigV2;
    expect(patchedConfig.status).toBe("ready");
    expect(patchedConfig.previewMap?.assetId).toBe("asset-1");
    expect(patchedConfig.auditLog?.at(-1)).toEqual(
      expect.objectContaining({ action: "preview-map", outcome: "success" }),
    );
  });

  it("reuses the tracked asset and warns that a published index needs republishing", async () => {
    mocks.getCatalogEntry.mockResolvedValue(
      catalogEntry(true, {
        ...config,
        previewMap: { assetId: "asset-antigo", capturedAt: "2026-08-01" },
      }),
    );

    const result = await saveIndexCatalogPreviewMap(
      "entry-1",
      PNG_DATA_URL,
      user,
    );

    expect(result.requiresRepublish).toBe(true);
    expect(mocks.saveContentfulAsset).toHaveBeenCalledWith(
      expect.objectContaining({ assetId: "asset-antigo" }),
    );
  });

  it("rejects an invalid capture before touching Contentful", async () => {
    mocks.getCatalogEntry.mockResolvedValue(catalogEntry(false));

    await expect(
      saveIndexCatalogPreviewMap("entry-1", "data:text/plain,oi", user),
    ).rejects.toThrow("data:image/png;base64,");
    expect(mocks.saveContentfulAsset).not.toHaveBeenCalled();
    expect(mocks.patchManagementEntry).not.toHaveBeenCalled();
  });

  it("refuses entries the catalog has not adopted", async () => {
    mocks.getCatalogEntry.mockResolvedValue(
      catalogEntry(false, { schemaVersion: 1, panelLayerId: "legado" }),
    );

    await expect(
      saveIndexCatalogPreviewMap("entry-1", PNG_DATA_URL, user),
    ).rejects.toThrow(/não foi adotado/u);
  });
});

describe("getIndexCatalogPreviewMapUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves the linked asset url", async () => {
    mocks.getContentfulAsset.mockResolvedValue({
      sys: { id: "asset-1", version: 3 },
      fields: { file: { "en-US": { url: "https://images/previa.png" } } },
    });

    const url = await getIndexCatalogPreviewMapUrl(
      {
        sys: { id: "entry-1", version: 4 },
        fields: { previewMap: { "en-US": { sys: { id: "asset-1" } } } },
      },
      "en-US",
    );

    expect(url).toBe("https://images/previa.png");
  });

  it("returns null without an image and never fails the preview", async () => {
    expect(
      await getIndexCatalogPreviewMapUrl(
        { sys: { id: "entry-1", version: 4 }, fields: {} },
        "en-US",
      ),
    ).toBeNull();

    mocks.getContentfulAsset.mockRejectedValue(new Error("status 404"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    expect(
      await getIndexCatalogPreviewMapUrl(
        {
          sys: { id: "entry-1", version: 4 },
          fields: { previewMap: { "en-US": { sys: { id: "apagado" } } } },
        },
        "en-US",
      ),
    ).toBeNull();
    consoleError.mockRestore();
  });
});
