import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const contentful = vi.hoisted(() => ({
  ensureIndexCatalogContentModel: vi.fn(),
  getCatalogEntry: vi.fn(),
  getLocalizedEntryField: vi.fn(),
  getManagementEntry: vi.fn(),
  patchManagementEntry: vi.fn(),
}));

vi.mock("@/services/indexCatalog/contentfulManagement", () => contentful);

import { adoptLegacyIndexCatalogEntry } from "@/services/indexCatalog/legacyAdoption";
import type { IndexCatalogPresentationConfigV2 } from "@/types/indexCatalog";

const user = { uid: "admin-1", email: "oca-dev@gmail.com" };
const storedReport = {
  schemaVersion: 1 as const,
  sections: [{ title: "Situação atual", text: "Em [municipio]." }],
};

function stubLegacyEntry(
  overrides: Partial<{
    published: boolean;
    adoptable: boolean;
    adoptionBlockedReason: string;
    panelLayerId: string;
    measurementUnit: string;
    panelPosition: number;
    catalogConfig: unknown;
    previewMapAssetId: string;
    reportConfig: unknown;
  }> = {},
) {
  const entry = {
    sys: { id: "entry-legacy", version: 12 },
    fields: {
      ...(overrides.previewMapAssetId
        ? {
            previewMap: {
              "en-US": { sys: { id: overrides.previewMapAssetId } },
            },
          }
        : {}),
    },
  };
  contentful.getCatalogEntry.mockResolvedValue({
    entry,
    locale: "en-US",
    item: {
      entryId: "entry-legacy",
      panelLayerId: overrides.panelLayerId ?? "s2id_secas_estiagens",
      name: "Registros de Secas e Estiagens",
      description: "Ocorrências registradas no S2iD.",
      category: "Dados Climáticos",
      measurementUnit: overrides.measurementUnit ?? "registros",
      panelPosition: overrides.panelPosition ?? 4,
      published: overrides.published ?? true,
      everPublished: overrides.published ?? true,
      hasUnpublishedChanges: false,
      catalogManaged: false,
      managedScope: null,
      adoptable: overrides.adoptable ?? true,
      ...(overrides.adoptionBlockedReason
        ? { adoptionBlockedReason: overrides.adoptionBlockedReason }
        : {}),
      status: "legacy",
      ...(overrides.catalogConfig
        ? { catalogConfig: overrides.catalogConfig }
        : {}),
    },
  });
  contentful.getManagementEntry.mockResolvedValue(entry);
  contentful.patchManagementEntry.mockResolvedValue(entry);
  contentful.getLocalizedEntryField.mockReturnValue(overrides.reportConfig);
  return entry;
}

function patchedFields() {
  return contentful.patchManagementEntry.mock.calls[0][1] as Record<
    string,
    unknown
  >;
}

function adoptedConfig() {
  return patchedFields().catalogConfig as IndexCatalogPresentationConfigV2;
}

describe("adoptLegacyIndexCatalogEntry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grava somente o catalogConfig, para o índice publicado não mudar", async () => {
    stubLegacyEntry();

    const result = await adoptLegacyIndexCatalogEntry("entry-legacy", user);

    expect(result).toMatchObject({
      panelLayerId: "s2id_secas_estiagens",
      managedScope: "presentation",
      status: "published",
    });
    expect(Object.keys(patchedFields())).toEqual(["catalogConfig"]);
    expect(adoptedConfig()).toMatchObject({
      schemaVersion: 2,
      managedScope: "presentation",
      name: "Registros de Secas e Estiagens",
      category: "Dados Climáticos",
      measurementUnit: "registros",
      panelPosition: 4,
    });
    expect(adoptedConfig().auditLog?.at(-1)).toMatchObject({
      action: "adopt",
      outcome: "success",
    });
  });

  it("não escreve statisticsSource, classes nem earthEngine", async () => {
    // Gravar `panelLayer.statisticsSource` desligaria o fallback do Contentful
    // sem volta: o repositório relança o erro do GEE em vez de ler as partições.
    stubLegacyEntry();

    await adoptLegacyIndexCatalogEntry("entry-legacy", user);

    const config = adoptedConfig() as unknown as Record<string, unknown>;
    expect(config.statisticsSource).toBeUndefined();
    expect(config.classes).toBeUndefined();
    expect(config.earthEngine).toBeUndefined();
    expect(patchedFields().statisticsSource).toBeUndefined();
    expect(patchedFields().imageData).toBeUndefined();
  });

  it("herda o texto do relatório já gravado na entry", async () => {
    stubLegacyEntry({ reportConfig: storedReport });

    await adoptLegacyIndexCatalogEntry("entry-legacy", user);

    expect(adoptedConfig().report).toEqual(storedReport);
  });

  it("não herda o asset da imagem de prévia feita à mão", async () => {
    // Reaproveitar o id faria a primeira captura do catálogo sobrescrever o
    // arquivo da captura de tela original.
    stubLegacyEntry({ previewMapAssetId: "asset-antigo" });

    await adoptLegacyIndexCatalogEntry("entry-legacy", user);

    expect(adoptedConfig().previewMap).toBeUndefined();
  });

  it("registra que a entry vinha de um catalogConfig v1", async () => {
    stubLegacyEntry({
      catalogConfig: {
        schemaVersion: 1,
        panelLayerId: "teste",
        status: "draft",
      },
      published: false,
    });

    await adoptLegacyIndexCatalogEntry("entry-legacy", user);

    expect(adoptedConfig().adoptedFrom.previousSchemaVersion).toBe(1);
    expect(adoptedConfig().status).toBe("draft");
  });

  it("recusa um índice que o catálogo já gerencia", async () => {
    stubLegacyEntry({
      catalogConfig: { schemaVersion: 2, panelLayerId: "aridez" },
    });

    await expect(
      adoptLegacyIndexCatalogEntry("entry-legacy", user),
    ).rejects.toThrow(/já é gerenciado/u);
    expect(contentful.patchManagementEntry).not.toHaveBeenCalled();
  });

  it("recusa a entry cujo imageData ainda é pré-compacto", async () => {
    stubLegacyEntry({
      adoptable: false,
      adoptionBlockedReason:
        "O imageData desta entry ainda está no formato pré-compacto (imageParams por ano).",
    });

    await expect(
      adoptLegacyIndexCatalogEntry("entry-legacy", user),
    ).rejects.toThrow(/pré-compacto/u);
    expect(contentful.patchManagementEntry).not.toHaveBeenCalled();
  });

  it("recusa a entry sem o campo id", async () => {
    stubLegacyEntry({ panelLayerId: "  " });

    await expect(
      adoptLegacyIndexCatalogEntry("entry-legacy", user),
    ).rejects.toThrow(/campo id/u);
  });
});
