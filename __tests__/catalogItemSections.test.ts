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
    status: "draft",
    ...overrides,
  } as IndexCatalogItem;
}

describe("splitCatalogItemsIntoSections", () => {
  it("separa publicados de não publicados", () => {
    const published = buildItem({ entryId: "a", published: true });
    const draft = buildItem({ entryId: "b" });

    const sections = splitCatalogItemsIntoSections([published, draft]);

    expect(sections.map((section) => section.key)).toEqual([
      "unpublished",
      "published-outdated",
      "published",
    ]);
    expect(sections[0].items).toEqual([draft]);
    expect(sections[1].items).toEqual([]);
    expect(sections[2].items).toEqual([published]);
  });

  it("não lista um panelLayer que o catálogo não gerencia", () => {
    const legacyPublished = buildItem({
      catalogManaged: false,
      published: true,
    });

    const sections = splitCatalogItemsIntoSections([legacyPublished]);

    expect(sections.every((section) => section.items.length === 0)).toBe(true);
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

describe("splitCatalogItemsIntoSections e a varredura de novos dados", () => {
  it("tira de Publicados o índice que a varredura apontou como desatualizado", () => {
    const outdated = buildItem({ entryId: "a", published: true });
    const current = buildItem({ entryId: "b", published: true });

    const sections = splitCatalogItemsIntoSections(
      [outdated, current],
      "",
      new Set(["a"]),
    );

    expect(sections.find((s) => s.key === "published-outdated")?.items).toEqual(
      [outdated],
    );
    expect(sections.find((s) => s.key === "published")?.items).toEqual([
      current,
    ]);
  });

  // Enquanto a varredura não responde ninguém é acusado de desatualizado: a
  // seção nova nasce vazia, e não com todos os publicados dentro.
  it("deixa todo publicado em Publicados enquanto a varredura não responde", () => {
    const published = buildItem({ entryId: "a", published: true });

    const sections = splitCatalogItemsIntoSections([published]);

    expect(sections.find((s) => s.key === "published-outdated")?.items).toEqual(
      [],
    );
    expect(sections.find((s) => s.key === "published")?.items).toEqual([
      published,
    ]);
  });

  it("nunca manda um rascunho para a seção de publicados desatualizados", () => {
    const draft = buildItem({ entryId: "a", published: false });

    const sections = splitCatalogItemsIntoSections([draft], "", new Set(["a"]));

    expect(sections.find((s) => s.key === "unpublished")?.items).toEqual([
      draft,
    ]);
    expect(sections.find((s) => s.key === "published-outdated")?.items).toEqual(
      [],
    );
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
