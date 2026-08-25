"use client";

import { useState } from "react";
import {
  catalogApiRequest as apiRequest,
  catalogIdempotencyKey as idempotencyKey,
} from "@/components/IndexCatalog/catalogApiClient";
import type {
  IndexCatalogItem,
  IndexCatalogLifecycleImpact,
} from "@/types/indexCatalog";

interface CatalogEntryLifecycleOptions {
  loadItems: () => Promise<IndexCatalogItem[]>;
  setBusy: (busy: string | null) => void;
  setMessage: (message: string) => void;
  setError: (error: string) => void;
  /** A remoção também limpa o editor: a entry que estava aberta deixou de existir. */
  resetEditor: () => void;
}

/**
 * Ciclo de vida das entradas já existentes: publicar, despublicar e remover.
 *
 * Fica separado do editor de rascunho porque nenhuma dessas ações depende do que
 * está preenchido no formulário — elas agem sobre uma entry da lista.
 */
export function useCatalogEntryLifecycle({
  loadItems,
  setBusy,
  setMessage,
  setError,
  resetEditor,
}: CatalogEntryLifecycleOptions) {
  const [deleteImpact, setDeleteImpact] =
    useState<IndexCatalogLifecycleImpact | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");

  async function togglePublication(item: IndexCatalogItem) {
    const action = item.published ? "unpublish" : "publish";
    setBusy(`lifecycle-${item.entryId}`);
    try {
      await apiRequest(
        `/api/index-catalog/entries/${encodeURIComponent(item.entryId)}`,
        {
          method: "POST",
          headers: {
            "Idempotency-Key": idempotencyKey(action, item.entryId),
          },
          body: JSON.stringify({ action }),
        },
      );
      setMessage(
        item.published
          ? `“${item.name}” foi despublicado.`
          : `“${item.name}” foi publicado.`,
      );
      await loadItems();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Falha no ciclo de vida.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function reviewDeletion(item: IndexCatalogItem) {
    setBusy(`delete-${item.entryId}`);
    try {
      setDeleteImpact(
        await apiRequest<IndexCatalogLifecycleImpact>(
          `/api/index-catalog/entries/${encodeURIComponent(item.entryId)}`,
        ),
      );
      setDeleteConfirmation("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao revisar.");
    } finally {
      setBusy(null);
    }
  }

  async function removeIndex() {
    if (!deleteImpact) return;
    setBusy("delete");
    try {
      await apiRequest(
        `/api/index-catalog/entries/${encodeURIComponent(
          deleteImpact.item.entryId,
        )}`,
        {
          method: "DELETE",
          headers: {
            "Idempotency-Key": idempotencyKey(
              "delete",
              deleteImpact.item.entryId,
            ),
          },
          body: JSON.stringify({ confirmation: deleteConfirmation }),
        },
      );
      setDeleteImpact(null);
      setMessage("O panelLayer foi removido. Nenhum asset GEE foi alterado.");
      resetEditor();
      await loadItems();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Falha ao remover.");
    } finally {
      setBusy(null);
    }
  }

  return {
    deleteImpact,
    deleteConfirmation,
    setDeleteConfirmation,
    cancelDeletion: () => setDeleteImpact(null),
    togglePublication,
    reviewDeletion,
    removeIndex,
  };
}
