"use client";

import { CATALOG_BUTTON_CLASS } from "@/components/IndexCatalog/catalogFormStyles";
import type { IndexCatalogItem } from "@/types/indexCatalog";

function statusLabel(item: IndexCatalogItem) {
  if (!item.catalogManaged) return "Legado — somente leitura";
  if (item.published && item.hasUnpublishedChanges) {
    return "Publicado com revisão em rascunho";
  }
  if (item.published) return "Publicado";
  if (item.status === "ready") return "Prévia validada";
  if (item.status === "error") return "Requer correções";
  return "Rascunho";
}

interface CatalogEntryListProps {
  items: IndexCatalogItem[];
  loading: boolean;
  onResume: (item: IndexCatalogItem) => void;
  onTogglePublication: (item: IndexCatalogItem) => void;
  onReviewDeletion: (item: IndexCatalogItem) => void;
}

export function CatalogEntryList({
  items,
  loading,
  onResume,
  onTogglePublication,
  onReviewDeletion,
}: CatalogEntryListProps) {
  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <h2 className="text-lg font-bold">Índices existentes</h2>
      {loading ? (
        <p className="mt-3 text-sm">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">
          Nenhum panelLayer encontrado.
        </p>
      ) : (
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.entryId}
              className="rounded-lg border border-stone-200 p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">{item.name}</h3>
                <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px]">
                  {statusLabel(item)}
                </span>
              </div>
              <p className="mt-2 text-xs text-stone-500">{item.panelLayerId}</p>
              {!item.catalogManaged && (
                <p className="mt-3 text-xs text-amber-800">
                  Configuração v1 ou índice externo. Visível, mas não editável
                  por este formulário.
                </p>
              )}
              {item.catalogManaged && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={`${CATALOG_BUTTON_CLASS} bg-[#E8E9DC]`}
                    onClick={() => onResume(item)}
                  >
                    Abrir e editar
                  </button>
                  {item.published && (
                    <button
                      type="button"
                      className={`${CATALOG_BUTTON_CLASS} border border-stone-300`}
                      onClick={() => onTogglePublication(item)}
                    >
                      Despublicar
                    </button>
                  )}
                  {!item.published && item.status === "ready" && (
                    <button
                      type="button"
                      className={`${CATALOG_BUTTON_CLASS} bg-[#989F43] text-white`}
                      onClick={() => onTogglePublication(item)}
                    >
                      Publicar
                    </button>
                  )}
                  <button
                    type="button"
                    className={`${CATALOG_BUTTON_CLASS} text-red-700`}
                    onClick={() => onReviewDeletion(item)}
                  >
                    Remover
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
