"use client";

import { useState } from "react";
import { catalogApiRequest } from "@/components/IndexCatalog/catalogApiClient";
import type {
  CatalogNewDataCheck,
  IndexCatalogItem,
} from "@/types/indexCatalog";

const NEW_DATA_TONE: Record<CatalogNewDataCheck["status"], string> = {
  "new-data": "bg-amber-50 text-amber-900",
  "up-to-date": "bg-emerald-50 text-emerald-900",
  "not-applicable": "bg-stone-100 text-stone-600",
  "never-validated": "bg-stone-100 text-stone-600",
};

/**
 * Pergunta ao Earth Engine se a pasta do índice ganhou período novo ou teve um
 * asset reescrito desde a última validação.
 *
 * Existe porque nada avisava: um asset de 2026 publicado na pasta ficava
 * invisível até alguém reabrir o índice e revalidar na mão, e a validação
 * inteira lê todas as tabelas. Esta verificação só lista a pasta.
 */
export function CatalogNewDataButton({
  item,
  buttonClass,
}: {
  item: IndexCatalogItem;
  buttonClass: string;
}) {
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<CatalogNewDataCheck | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runCheck() {
    setChecking(true);
    setError(null);
    try {
      setCheck(
        await catalogApiRequest<CatalogNewDataCheck>(
          `/api/index-catalog/drafts/${encodeURIComponent(item.entryId)}/new-data`,
        ),
      );
    } catch (reason) {
      setCheck(null);
      setError(
        reason instanceof Error
          ? reason.message
          : "Não foi possível verificar a pasta do Earth Engine.",
      );
    } finally {
      setChecking(false);
    }
  }

  // O resultado é irmão dos botões no mesmo flex-wrap do cartão: `order-last`
  // o joga para o fim da linha, senão ele se intercala entre "Verificar novos
  // dados" e "Despublicar".
  return (
    <>
      <button
        type="button"
        className={`${buttonClass} border border-stone-300`}
        disabled={checking}
        onClick={runCheck}
      >
        {checking ? "Verificando…" : "Verificar novos dados"}
      </button>
      {error && (
        <p className="order-last mt-1 w-full rounded-md bg-red-50 p-2 text-xs text-red-800">
          {error}
        </p>
      )}
      {check && (
        <p
          className={`order-last mt-1 w-full rounded-md p-2 text-xs ${NEW_DATA_TONE[check.status]}`}
          role="status"
        >
          {check.message}
        </p>
      )}
    </>
  );
}
