"use client";

import type { IndexCatalogPreview } from "@/types/indexCatalog";

export interface CatalogApiErrorBody {
  error?: string;
  validation?: IndexCatalogPreview["validation"];
}

/**
 * Cliente das rotas do catálogo: mesma origem, JSON, e o erro do servidor
 * preservado com a validação para a tela poder listar cada problema.
 */
export async function catalogApiRequest<T>(
  path: string,
  options: RequestInit = {},
) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const body = (await response
    .json()
    .catch(() => ({}))) as CatalogApiErrorBody & T;
  if (!response.ok) {
    throw Object.assign(
      new Error(body.error ?? `A requisição falhou (${response.status}).`),
      { validation: body.validation },
    );
  }
  return body;
}

/** As mutações do catálogo exigem Idempotency-Key entre 8 e 200 caracteres. */
export function catalogIdempotencyKey(action: string, entryId: string) {
  return `${action}-${entryId}-${crypto.randomUUID()}`;
}

/**
 * Pede a validação e, se a conexão cair antes da resposta, tenta recuperar o
 * resultado que o servidor concluiu de qualquer forma.
 *
 * O `POST` roda a validação inteira numa requisição só. Quando o proxy do
 * ambiente desiste de esperar, o navegador recebe uma rejeição de rede — mas o
 * servidor **não para**: ele termina o trabalho e grava a validação. O `GET` da
 * mesma rota devolve esse resultado sem tocar no Earth Engine.
 *
 * A comparação com `startedAt` é o que impede aceitar uma prévia antiga: só uma
 * validação concluída depois do início desta tentativa conta como resposta dela.
 *
 * @example
 * const preview = await requestCatalogPreview(entryId, "preview-abc-123", Date.now());
 */
export async function requestCatalogPreview(
  entryId: string,
  idempotencyKeyValue: string,
  startedAt = Date.now(),
) {
  const path = `/api/index-catalog/drafts/${encodeURIComponent(entryId)}/preview`;
  try {
    return await catalogApiRequest<IndexCatalogPreview>(path, {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKeyValue },
    });
  } catch (reason) {
    const recovered = await catalogApiRequest<IndexCatalogPreview>(path).catch(
      () => null,
    );
    const validatedAt = Date.parse(recovered?.validation.validatedAt ?? "");
    if (recovered && Number.isFinite(validatedAt) && validatedAt >= startedAt) {
      return recovered;
    }
    throw reason;
  }
}
