import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const contentful = vi.hoisted(() => ({
  ensureIndexCatalogContentModel: vi.fn(),
  getCatalogEntry: vi.fn(),
  patchManagementEntry: vi.fn(),
}));

vi.mock("@/services/indexCatalog/contentfulManagement", () => contentful);

import { saveIndexCatalogTranslations } from "@/services/indexCatalog/translationsService";
import { parseIndexTranslations } from "@/utils/indexCatalog";

const user = { uid: "admin-1", email: "oca-dev@gmail.com" };
const validation = { valid: true, sourceFingerprint: "fingerprint-original" };
const readyConfig = {
  schemaVersion: 2 as const,
  panelLayerId: "aridez-catalogo",
  status: "ready" as const,
  name: "Aridez",
  validation,
  createdBy: { ...user, at: "2026-08-17T10:00:00.000Z" },
  updatedBy: { ...user, at: "2026-08-17T12:00:00.000Z" },
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
  contentful.patchManagementEntry.mockResolvedValue(entry);
}

function patchedFields() {
  return contentful.patchManagementEntry.mock.calls[0][1] as Record<
    string,
    unknown
  >;
}

describe("parseIndexTranslations", () => {
  it("guarda só o que foi preenchido, sem espaços nas pontas", () => {
    expect(
      parseIndexTranslations({
        en: {
          name: " Drought Monitor ",
          description: "",
          classLabels: { "Seca fraca": " Weak drought ", "Sem seca": "" },
        },
        es: { name: "  " },
      }),
    ).toEqual({
      en: {
        name: "Drought Monitor",
        classLabels: { "Seca fraca": "Weak drought" },
      },
    });
  });

  it("recusa o que não é texto", () => {
    expect(() => parseIndexTranslations({ en: { name: 42 } })).toThrow(
      "Nome em inglês inválido.",
    );
    expect(() =>
      parseIndexTranslations({ es: { classLabels: ["Seca"] } }),
    ).toThrow("Rótulos em espanhol inválidos.");
  });
});

describe("saveIndexCatalogTranslations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentful.ensureIndexCatalogContentModel.mockResolvedValue({
      changed: false,
    });
  });

  it("grava cada idioma no campo próprio do panelLayer e apaga o que ficou vazio", async () => {
    stubEntry({ published: true });

    const result = await saveIndexCatalogTranslations(
      "panel",
      {
        en: { name: "Aridity", classLabels: { Árido: "Arid" } },
        es: { description: "Índice de aridez" },
      },
      user,
    );

    expect(patchedFields()).toMatchObject({
      nameEn: "Aridity",
      descriptionEs: "Índice de aridez",
      classLabelsEn: { Árido: "Arid" },
    });
    for (const field of ["nameEs", "descriptionEn", "classLabelsEs"]) {
      expect(patchedFields()).toHaveProperty(field, undefined);
    }
    expect(result.requiresRepublish).toBe(true);
    expect(contentful.ensureIndexCatalogContentModel).toHaveBeenCalledOnce();
  });

  it("preserva a prévia validada e registra a ação", async () => {
    stubEntry();

    await saveIndexCatalogTranslations(
      "panel",
      { en: { name: "Aridity" } },
      user,
    );

    const config = patchedFields().catalogConfig as typeof readyConfig;
    expect(config.status).toBe("ready");
    expect(config.validation).toEqual(validation);
    expect(config.auditLog.at(-1)).toMatchObject({
      action: "translations",
      outcome: "success",
    });
  });

  it("recusa índice que o catálogo ainda não adotou", async () => {
    stubEntry({ legacy: true });

    await expect(
      saveIndexCatalogTranslations("panel", { en: { name: "X" } }, user),
    ).rejects.toThrow("Adotar no catálogo");
    expect(contentful.patchManagementEntry).not.toHaveBeenCalled();
  });
});
