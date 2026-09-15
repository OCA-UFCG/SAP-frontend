import { describe, expect, it } from "vitest";
import {
  matchesCatalogSearch,
  splitCatalogItemsIntoSections,
} from "@/utils/catalogItemSections";
import type { IndexCatalogItem } from "@/types/indexCatalog";

function buildItem(overrides: Partial<IndexCatalogItem>): IndexCatalogItem {
  return {
    entryId: "entry-1",
    panelLayerId: "CDI_Test",
    name: "Índice de teste",
    description: "",
    published: false,
    everPublished: false,
    hasUnpublishedChanges: false,
    catalogManaged: true,
    managedScope: "full",
    adoptable: false,
    status: "draft",
    ...overrides,
  } as IndexCatalogItem;
}

describe("splitCatalogItemsIntoSections", () => {
  it("separa publicados, não publicados e legados fora do catálogo", () => {
    const published = buildItem({ entryId: "a", published: true });
    const draft = buildItem({ entryId: "b" });
    const legacy = buildItem({ entryId: "c", catalogManaged: false });

    const sections = splitCatalogItemsIntoSections([published, draft, legacy]);

    expect(sections.map((section) => section.key)).toEqual([
      "unpublished",
      "published",
      "legacy",
    ]);
    expect(sections[0].items).toEqual([draft]);
    expect(sections[1].items).toEqual([published]);
    expect(sections[2].items).toEqual([legacy]);
  });

  it("conta um legado já publicado como legado, não como publicado", () => {
    const legacyPublished = buildItem({
      catalogManaged: false,
      published: true,
    });

    const sections = splitCatalogItemsIntoSections([legacyPublished]);

    expect(sections.find((s) => s.key === "legacy")?.items).toHaveLength(1);
    expect(sections.find((s) => s.key === "published")?.items).toHaveLength(0);
  });

  it("mantém a seção vazia na lista para a tela poder anunciá-la", () => {
    const sections = splitCatalogItemsIntoSections([]);
    expect(sections).toHaveLength(3);
    expect(sections.every((section) => section.items.length === 0)).toBe(true);
  });

  it("filtra pela busca antes de agrupar", () => {
    const wanted = buildItem({ entryId: "a", name: "Secas e Estiagens" });
    const other = buildItem({ entryId: "b", name: "Carbono" });

    const sections = splitCatalogItemsIntoSections([wanted, other], "secas");

    expect(sections.find((s) => s.key === "unpublished")?.items).toEqual([
      wanted,
    ]);
  });
});

describe("matchesCatalogSearch", () => {
  it("ignora acentos e caixa", () => {
    const item = buildItem({ name: "Índice de Áridez" });
    expect(matchesCatalogSearch(item, "aridez")).toBe(true);
  });

  it("também encontra pelo ID técnico do panelLayer", () => {
    const item = buildItem({ panelLayerId: "carbonoembrapa" });
    expect(matchesCatalogSearch(item, "embrapa")).toBe(true);
  });

  it("aceita tudo quando a busca está vazia", () => {
    expect(matchesCatalogSearch(buildItem({}), "   ")).toBe(true);
  });
});
