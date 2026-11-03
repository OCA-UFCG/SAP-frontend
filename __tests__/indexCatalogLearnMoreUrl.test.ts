import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const contentful = vi.hoisted(() => ({
  ensureIndexCatalogContentModel: vi.fn(),
  getCatalogEntry: vi.fn(),
  patchManagementEntry: vi.fn(),
}));

vi.mock("@/services/indexCatalog/contentfulManagement", () => contentful);

import { saveIndexCatalogLearnMoreUrl } from "@/services/indexCatalog/learnMoreUrlService";
import { parseLearnMoreUrl } from "@/utils/indexCatalog";

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

describe("parseLearnMoreUrl", () => {
  it("aceita um endereço completo e tira os espaços das pontas", () => {
    expect(parseLearnMoreUrl("  https://www.gov.br/ana/pt-br  ")).toBe(
      "https://www.gov.br/ana/pt-br",
    );
    expect(parseLearnMoreUrl("http://exemplo.org")).toBe("http://exemplo.org");
  });

  it("lê campo vazio como sem link", () => {
    expect(parseLearnMoreUrl("")).toBeUndefined();
    expect(parseLearnMoreUrl("   ")).toBeUndefined();
    expect(parseLearnMoreUrl(undefined)).toBeUndefined();
  });

  it.each([
    "www.gov.br/ana",
    "javascript:alert(1)",
    "ftp://exemplo.org/arquivo",
    "https://exemplo.org/com espaço",
  ])("recusa %s", (value) => {
    expect(() => parseLearnMoreUrl(value)).toThrow(/https:\/\//u);
  });

  it("recusa endereço maior que o campo do Contentful", () => {
    expect(() =>
      parseLearnMoreUrl(`https://exemplo.org/${"a".repeat(300)}`),
    ).toThrow(/256 caracteres/u);
  });
});

describe("saveIndexCatalogLearnMoreUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    contentful.ensureIndexCatalogContentModel.mockResolvedValue({
      changed: false,
    });
  });

  it("grava o link no panelLayer e no catalogConfig", async () => {
    stubEntry();

    const result = await saveIndexCatalogLearnMoreUrl(
      "panel",
      "https://www.gov.br/ana",
      user,
    );

    expect(patchedFields().learnMoreUrl).toBe("https://www.gov.br/ana");
    expect(patchedFields().catalogConfig).toMatchObject({
      learnMoreUrl: "https://www.gov.br/ana",
    });
    expect(result.learnMoreUrl).toBe("https://www.gov.br/ana");
    expect(contentful.ensureIndexCatalogContentModel).toHaveBeenCalledOnce();
  });

  it("preserva a prévia validada: não zera status nem validation", async () => {
    stubEntry();

    await saveIndexCatalogLearnMoreUrl("panel", "https://www.gov.br/ana", user);

    const config = patchedFields().catalogConfig as typeof readyConfig;
    expect(config.status).toBe("ready");
    expect(config.validation).toEqual(validation);
    expect(config.auditLog.at(-1)).toMatchObject({
      action: "learn-more-url",
      outcome: "success",
      uid: "admin-1",
    });
  });

  it("apaga o campo quando o link fica vazio, tirando o botão", async () => {
    stubEntry();

    const result = await saveIndexCatalogLearnMoreUrl("panel", "", user);

    expect(patchedFields()).toHaveProperty("learnMoreUrl", undefined);
    expect(result.learnMoreUrl).toBeNull();
  });

  it("avisa que uma entry publicada precisa ser republicada", async () => {
    stubEntry({ published: true });

    const result = await saveIndexCatalogLearnMoreUrl(
      "panel",
      "https://www.gov.br/ana",
      user,
    );

    expect(result.requiresRepublish).toBe(true);
  });

  it("recusa um link sem protocolo sem tocar no Contentful", async () => {
    stubEntry();

    await expect(
      saveIndexCatalogLearnMoreUrl("panel", "www.gov.br/ana", user),
    ).rejects.toThrow(/inválido/u);
    expect(contentful.patchManagementEntry).not.toHaveBeenCalled();
  });

  it("recusa um índice que o catálogo não adotou", async () => {
    stubEntry({ legacy: true });

    await expect(
      saveIndexCatalogLearnMoreUrl("panel", "https://www.gov.br/ana", user),
    ).rejects.toThrow(/não foi adotado/u);
  });
});
