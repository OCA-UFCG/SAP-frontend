"use client";

import { useMemo, useState } from "react";
import { CatalogNewDataButton } from "@/components/IndexCatalog/CatalogNewDataButton";
import {
  splitCatalogItemsIntoSections,
  type CatalogSectionKey,
} from "@/utils/catalogItemSections";
import { hasPublishableValidation } from "@/utils/indexCatalog";
import type {
  CatalogNewDataCheck,
  IndexCatalogItem,
} from "@/types/indexCatalog";

export function statusLabel(item: IndexCatalogItem) {
  if (item.managedScope === "presentation") {
    if (item.published && item.hasUnpublishedChanges) {
      return "Legado adotado — alterações não publicadas";
    }
    return item.published ? "Legado adotado — publicado" : "Legado adotado";
  }
  if (item.published && item.hasUnpublishedChanges) {
    return "Publicado com revisão em rascunho";
  }
  if (item.published) return "Publicado";
  if (item.status === "ready") return "Prévia validada";
  if (item.status === "error") return "Requer correções";
  return "Rascunho";
}

interface CatalogIndexSectionsProps {
  items: IndexCatalogItem[];
  loading: boolean;
  /** O que a varredura de novos dados respondeu, por `entryId`. */
  newDataChecks: Record<string, CatalogNewDataCheck>;
  /** True enquanto a varredura ainda não respondeu. */
  scanningNewData: boolean;
  /** Índices publicados que a varredura não conseguiu verificar. */
  newDataFailures: number;
  inputClass: string;
  buttonClass: string;
  onOpenLegacyEditor: (item: IndexCatalogItem) => void;
  onResumeDraft: (item: IndexCatalogItem) => void;
  onChangePublication: (
    item: IndexCatalogItem,
    action: "publish" | "unpublish",
  ) => void;
  onReviewDeletion: (item: IndexCatalogItem) => void;
}

function CatalogIndexCard({
  item,
  buttonClass,
  newDataCheck,
  onOpenLegacyEditor,
  onResumeDraft,
  onChangePublication,
  onReviewDeletion,
}: {
  item: IndexCatalogItem;
  newDataCheck?: CatalogNewDataCheck;
} & Omit<
  CatalogIndexSectionsProps,
  | "items"
  | "loading"
  | "inputClass"
  | "newDataChecks"
  | "scanningNewData"
  | "newDataFailures"
>) {
  return (
    <article className="rounded-lg border border-stone-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold">{item.name}</h3>
        <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px]">
          {statusLabel(item)}
        </span>
      </div>
      <p className="mt-2 text-xs text-stone-500">{item.panelLayerId}</p>
      {item.managedScope === "presentation" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={`${buttonClass} bg-[#E8E9DC]`}
            onClick={() => onOpenLegacyEditor(item)}
          >
            Abrir e editar
          </button>
          {item.published && (
            <button
              type="button"
              className={`${buttonClass} border border-stone-300`}
              onClick={() => onChangePublication(item, "unpublish")}
            >
              Despublicar
            </button>
          )}
          {(!item.published || item.hasUnpublishedChanges) && (
            <button
              type="button"
              className={`${buttonClass} bg-[#989F43] text-white`}
              onClick={() => onChangePublication(item, "publish")}
            >
              {item.published ? "Republicar" : "Publicar"}
            </button>
          )}
          {!item.everPublished && (
            <button
              type="button"
              className={`${buttonClass} text-red-700`}
              onClick={() => onReviewDeletion(item)}
            >
              Remover
            </button>
          )}
        </div>
      )}
      {item.managedScope === "full" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className={`${buttonClass} bg-[#E8E9DC]`}
            onClick={() => onResumeDraft(item)}
          >
            Abrir e editar
          </button>
          <CatalogNewDataButton
            item={item}
            buttonClass={buttonClass}
            scannedCheck={newDataCheck}
          />
          {item.published && (
            <button
              type="button"
              className={`${buttonClass} border border-stone-300`}
              onClick={() => onChangePublication(item, "unpublish")}
            >
              Despublicar
            </button>
          )}
          {/* Republicar é o que leva ao ar o texto do relatório e a
              imagem do cartão, que são gravados no rascunho sem
              refazer a validação. Sem este botão a única saída era
              despublicar o índice e publicá-lo de novo. A condição é
              a mesma que a rota confere: um rascunho editado perdeu a
              validação e seria recusado no clique. */}
          {((!item.published && item.status === "ready") ||
            (item.published &&
              item.hasUnpublishedChanges &&
              hasPublishableValidation(item.status))) && (
            <button
              type="button"
              className={`${buttonClass} bg-[#989F43] text-white`}
              onClick={() => onChangePublication(item, "publish")}
            >
              {item.published ? "Republicar" : "Publicar"}
            </button>
          )}
          <button
            type="button"
            className={`${buttonClass} text-red-700`}
            onClick={() => onReviewDeletion(item)}
          >
            Remover
          </button>
        </div>
      )}
    </article>
  );
}

/**
 * Lista os índices em seções recolhíveis — não publicados, publicados e
 * legados — porque a listagem única já passava de cem cartões e o operador
 * abria a tela sem conseguir achar o rascunho em que estava trabalhando.
 */
export function CatalogIndexSections({
  items,
  loading,
  inputClass,
  newDataChecks,
  scanningNewData,
  newDataFailures,
  ...cardProps
}: CatalogIndexSectionsProps) {
  const [search, setSearch] = useState("");
  const [closedSections, setClosedSections] = useState<
    Partial<Record<CatalogSectionKey, boolean>>
  >({});
  const outdatedEntryIds = useMemo(
    () =>
      new Set(
        Object.entries(newDataChecks)
          .filter(([, check]) => check.status === "new-data")
          .map(([entryId]) => entryId),
      ),
    [newDataChecks],
  );
  const sections = useMemo(
    () => splitCatalogItemsIntoSections(items, search, outdatedEntryIds),
    [items, search, outdatedEntryIds],
  );

  function isOpen(key: CatalogSectionKey, defaultOpen: boolean) {
    // Uma busca ativa abre tudo: esconder o resultado atrás de uma seção
    // fechada faria o operador concluir que o índice não existe.
    if (search.trim()) return true;
    return closedSections[key] === undefined
      ? defaultOpen
      : !closedSections[key];
  }

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold">Índices existentes</h2>
        <input
          className={`${inputClass} max-w-xs`}
          type="search"
          value={search}
          placeholder="Buscar por nome ou ID"
          aria-label="Buscar índice por nome ou ID"
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {loading ? (
        <p className="mt-3 text-sm">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-stone-500">
          Nenhum panelLayer encontrado.
        </p>
      ) : (
        <div className="mt-4 space-y-3">
          {sections.map((section) => {
            const open = isOpen(section.key, section.defaultOpen);
            return (
              <div
                key={section.key}
                className="rounded-lg border border-stone-200"
              >
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left"
                  aria-expanded={open}
                  onClick={() =>
                    setClosedSections((current) => ({
                      ...current,
                      [section.key]: open,
                    }))
                  }
                >
                  <span>
                    <span className="font-semibold">{section.title}</span>
                    <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-[11px]">
                      {section.items.length}
                    </span>
                    <span className="block text-xs text-stone-500">
                      {section.key !== "published-outdated"
                        ? section.hint
                        : scanningNewData
                          ? "Verificando as pastas do Earth Engine…"
                          : newDataFailures > 0
                            ? `${section.hint} ${newDataFailures} índice(s) não puderam ser verificados.`
                            : section.hint}
                    </span>
                  </span>
                  <span aria-hidden className="text-stone-500">
                    {open ? "▾" : "▸"}
                  </span>
                </button>
                {open && (
                  <div className="px-4 pb-4">
                    {section.items.length === 0 ? (
                      <p className="text-sm text-stone-500">
                        {section.key === "published-outdated"
                          ? scanningNewData
                            ? "Verificando…"
                            : "Todo índice publicado está com os dados mais recentes da pasta dele."
                          : "Nenhum índice nesta seção."}
                      </p>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {section.items.map((item) => (
                          <CatalogIndexCard
                            key={item.entryId}
                            item={item}
                            newDataCheck={newDataChecks[item.entryId]}
                            {...cardProps}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
