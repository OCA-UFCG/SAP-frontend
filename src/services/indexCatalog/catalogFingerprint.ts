import { createHash } from "node:crypto";

/**
 * A impressão digital estável de uma configuração validada.
 *
 * É o que liga a prévia à publicação: o `sourceRevision` e o
 * `sourceFingerprint` saem daqui, e a publicação recusa uma prévia cujo
 * conteúdo mudou depois de validada.
 */
export function hashCatalogValue(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
