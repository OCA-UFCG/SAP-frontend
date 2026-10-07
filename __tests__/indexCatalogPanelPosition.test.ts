import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const contentful = vi.hoisted(() => ({
  getCatalogEntry: vi.fn(),
  getLocalizedEntryField: vi.fn(),
  getManagementEntry: vi.fn(),
  listCatalogEntries: vi.fn(),
  patchManagementEntry: vi.fn(),
  publishManagementEntry: vi.fn(),
}));

vi.mock("@/services/indexCatalog/contentfulManagement", () => contentful);
vi.mock("@/services/indexCatalog/previewMapService", () => ({
  getIndexCatalogPreviewMapUrl: vi.fn(),
}));
vi.mock("@/services/buildDoc/buildDocTemplate", () => ({
  getDocTemplate: vi.fn(),
}));

import { publishIndexCatalogPresentation } from "@/services/indexCatalog/presentationService";
import type { IndexCatalogPresentationConfigV2 } from "@/types/indexCatalog";

const user = { uid: "admin-1", email: "oca-dev@gmail.com" };

/** O índice que pede a posição 0, hoje na 15. */
const novoConfig: IndexCatalogPresentationConfigV2 = {
  schemaVersion: 2,
  managedScope: "presentation",
  panelLayerId: "monitor-de-seca-ana",
  status: "published",
  name: "Monitor de seca | ANA",
  description: "Monitor de secas.",
  category: "Dados Climáticos",
  measurementUnit: "classes",
  panelPosition: 0,
  createdBy: { ...user, at: "2026-09-01T10:00:00.000Z" },
  updatedBy: { ...user, at: "2026-09-01T10:00:00.000Z" },
  adoptedFrom: { at: "2026-09-01T10:00:00.000Z" },
  auditLog: [],
};

function managementEntry(id: string) {
  return { sys: { id, version: 4, publishedAt: "2026-09-01T10:00:00Z" } };
}

function stubCatalog(options: { occupantPendingChanges?: boolean } = {}) {
  const entries = [
    {
      entryId: "entry-novo",
      panelLayerId: "monitor-de-seca-ana",
      name: "Monitor de seca | ANA",
      category: "Dados Climáticos",
      panelPosition: 0,
    },
    {
      entryId: "entry-legado",
      panelLayerId: "anaseca",
      name: "Monitor de seca | ANA (legado)",
      category: "Dados Climáticos",
      panelPosition: 0,
    },
  ];
  const occupant = {
    entryId: "entry-legado",
    panelLayerId: "anaseca",
    name: "Monitor de seca | ANA (legado)",
    published: true,
    hasUnpublishedChanges: Boolean(options.occupantPendingChanges),
    catalogConfig: {
      ...novoConfig,
      panelLayerId: "anaseca",
      name: "Monitor de seca | ANA (legado)",
      panelPosition: 0,
    },
  };

  contentful.listCatalogEntries.mockResolvedValue(entries);
  contentful.getCatalogEntry.mockImplementation((entryId: string) =>
    Promise.resolve(
      entryId === "entry-legado"
        ? {
            entry: managementEntry("entry-legado"),
            locale: "en-US",
            item: occupant,
          }
        : {
            entry: managementEntry("entry-novo"),
            locale: "en-US",
            item: {
              entryId: "entry-novo",
              panelLayerId: "monitor-de-seca-ana",
              published: true,
              hasUnpublishedChanges: true,
              catalogConfig: novoConfig,
            },
          },
    ),
  );
  // A posição que este índice ocupa hoje na lista publicada.
  contentful.getLocalizedEntryField.mockImplementation(
    (_entry: unknown, fieldId: string) =>
      fieldId === "panelPosition" ? 15 : undefined,
  );
  contentful.patchManagementEntry.mockImplementation(
    (entry: { sys: { id: string } }) => Promise.resolve(entry),
  );
  contentful.publishManagementEntry.mockImplementation(
    (entry: { sys: { id: string } }) =>
      Promise.resolve({
        sys: { id: entry.sys.id, publishedAt: "2026-09-10T12:00:00.000Z" },
      }),
  );
}

function patchFor(entryId: string) {
  const call = contentful.patchManagementEntry.mock.calls.find(
    ([entry]: [{ sys: { id: string } }]) => entry.sys.id === entryId,
  );
  return (call?.[1] ?? {}) as Record<string, unknown>;
}

describe("posição na categoria ao publicar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("troca de lugar com o índice que já ocupava a posição pedida", async () => {
    stubCatalog();

    const result = await publishIndexCatalogPresentation("entry-novo", user);

    expect(patchFor("entry-novo")).toMatchObject({ panelPosition: 0 });
    // O ocupante recebe a posição que este índice deixou vazia, e é republicado
    // para a nova ordem valer no Monitoramento.
    expect(patchFor("entry-legado")).toMatchObject({ panelPosition: 15 });
    expect(patchFor("entry-legado").catalogConfig).toMatchObject({
      panelPosition: 15,
    });
    expect(contentful.publishManagementEntry).toHaveBeenCalledTimes(2);
    expect(result.positionNote).toMatch(/posição 15/u);
  });

  it("não publica o ocupante que tem outras alterações em rascunho", async () => {
    // Republicá-lo levaria ao ar uma edição que ninguém revisou só por causa de
    // uma troca de posição.
    stubCatalog({ occupantPendingChanges: true });

    const result = await publishIndexCatalogPresentation("entry-novo", user);

    expect(patchFor("entry-legado")).toMatchObject({ panelPosition: 15 });
    expect(contentful.publishManagementEntry).toHaveBeenCalledTimes(1);
    expect(result.positionNote).toMatch(/republique-a/u);
  });

  it("não diz que a publicação falhou quando só a troca falha", async () => {
    // O índice que pediu a posição já está no ar quando a troca roda: virar
    // erro aqui diria que a publicação não aconteceu.
    stubCatalog();
    contentful.patchManagementEntry.mockImplementation(
      (entry: { sys: { id: string } }) =>
        entry.sys.id === "entry-legado"
          ? Promise.reject(new Error("409 VersionMismatch"))
          : Promise.resolve(entry),
    );

    const result = await publishIndexCatalogPresentation("entry-novo", user);

    expect(result.status).toBe("published");
    expect(result.positionNote).toMatch(
      /mover o índice que estava nela falhou/u,
    );
  });

  it("mantém a posição publicada quando o formulário não pediu nenhuma", async () => {
    stubCatalog();
    contentful.getCatalogEntry.mockImplementation(() =>
      Promise.resolve({
        entry: managementEntry("entry-novo"),
        locale: "en-US",
        item: {
          entryId: "entry-novo",
          panelLayerId: "monitor-de-seca-ana",
          published: true,
          hasUnpublishedChanges: true,
          catalogConfig: { ...novoConfig, panelPosition: undefined },
        },
      }),
    );

    const result = await publishIndexCatalogPresentation("entry-novo", user);

    expect(patchFor("entry-novo")).toMatchObject({ panelPosition: 15 });
    expect(contentful.publishManagementEntry).toHaveBeenCalledTimes(1);
    expect(result.positionNote).toBeUndefined();
  });
});
