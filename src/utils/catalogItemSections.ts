import type { IndexCatalogItem } from "@/types/indexCatalog";

export type CatalogSectionKey = "published" | "unpublished";

export interface CatalogItemSection {
  key: CatalogSectionKey;
  title: string;
  /** Uma linha explicando quem está ali, para o operador não precisar deduzir. */
  hint: string;
  /**
   * Todas as seções abrem fechadas: com mais de quarenta índices cadastrados,
   * abrir qualquer uma delas por padrão devolve a tela superlotada que a
   * divisão veio resolver.
   */
  defaultOpen: boolean;
  items: IndexCatalogItem[];
}

const SECTION_DEFINITIONS: Omit<CatalogItemSection, "items">[] = [
  {
    key: "unpublished",
    title: "Não publicados",
    hint: "Rascunhos e índices adotados que ainda não estão no ar.",
    defaultOpen: false,
  },
  {
    key: "published",
    title: "Publicados",
    hint: "Índices visíveis na plataforma hoje.",
    defaultOpen: false,
  },
];

function sectionKeyOf(item: IndexCatalogItem): CatalogSectionKey {
  return item.published ? "published" : "unpublished";
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * Filtra pelo que o operador enxerga no cartão: o nome e o ID técnico.
 *
 * @example matchesCatalogSearch(item, "cdi")
 */
export function matchesCatalogSearch(item: IndexCatalogItem, search: string) {
  const query = normalizeSearchText(search);
  if (!query) return true;
  const haystack = normalizeSearchText(`${item.name} ${item.panelLayerId}`);
  return haystack.includes(query);
}

/**
 * Divide a listagem do catálogo nas seções que a tela renderiza, na ordem em
 * que elas aparecem. Seções vazias continuam na lista para a tela poder dizer
 * "nenhum índice aqui" em vez de sumir com o título.
 *
 * @example splitCatalogItemsIntoSections(items, "seca")
 */
export function splitCatalogItemsIntoSections(
  items: IndexCatalogItem[],
  search = "",
): CatalogItemSection[] {
  // Um panelLayer que o catálogo não gerencia não é listado: sem a adoção, não
  // há nada a fazer com ele por aqui, e ele só empurrava para baixo os índices
  // em que o operador trabalha de fato.
  const visible = items.filter(
    (item) => item.catalogManaged && matchesCatalogSearch(item, search),
  );
  return SECTION_DEFINITIONS.map((definition) => ({
    ...definition,
    items: visible.filter((item) => sectionKeyOf(item) === definition.key),
  }));
}
