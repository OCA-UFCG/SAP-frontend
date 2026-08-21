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
