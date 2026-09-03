import type { AuthenticatedUserSession } from "@/lib/server-session";
import {
  isFullyManagedCatalogConfig,
  isManagedCatalogConfig,
  isPresentationManagedCatalogConfig,
  type IndexCatalogConfig,
  type IndexCatalogConfigV2,
  type IndexCatalogPresentationConfigV2,
  type ManagedIndexCatalogConfig,
} from "@/types/indexCatalog";

export function catalogTimestamp() {
  return new Date().toISOString();
}

/** Toda escrita no catálogo deixa rastro de quem fez, quando e com que efeito. */
export function withAuditEvent<T extends ManagedIndexCatalogConfig>(
  config: T,
  user: AuthenticatedUserSession,
  event: {
    action: NonNullable<IndexCatalogConfigV2["auditLog"]>[number]["action"];
    outcome: "success" | "failure";
    message?: string;
  },
): T {
  return {
    ...config,
    auditLog: [
      ...(config.auditLog ?? []),
      { ...event, uid: user.uid, email: user.email, at: catalogTimestamp() },
    ].slice(-50),
  };
}

interface CatalogEntryWithConfig {
  item: { catalogConfig?: IndexCatalogConfig };
}

/**
 * Qualquer índice adotado pelo catálogo, em escopo completo ou de apresentação.
 * É a exigência das escritas que só tocam a própria entry — identidade, imagem
 * de prévia e texto do relatório.
 */
export function requireManagedConfig(current: CatalogEntryWithConfig) {
  if (!isManagedCatalogConfig(current.item.catalogConfig)) {
    throw new Error(
      "Este índice ainda não foi adotado pelo catálogo. Use “Adotar no catálogo” no cartão dele para editar nome, unidade, imagem e texto do relatório.",
    );
  }
  return current.item.catalogConfig;
}

/**
 * Só um índice criado pelo catálogo pode ser validado, ter prévia com
 * fingerprint ou ter a configuração de dados reescrita. Um legado adotado tem
 * os valores em outro lugar: reconstruir o `imageData` dele apagaria os
 * números que estão gravados ali.
 */
export function requireFullyManagedConfig(current: CatalogEntryWithConfig) {
  if (isPresentationManagedCatalogConfig(current.item.catalogConfig)) {
    throw new Error(
      "Este índice é legado e o catálogo gerencia apenas a apresentação dele: nome, unidade, imagem de prévia e texto do relatório. A origem dos dados continua na pipeline de CSV ou no registro estático.",
    );
  }
  if (!isFullyManagedCatalogConfig(current.item.catalogConfig)) {
    throw new Error(
      "Este índice ainda não foi adotado pelo catálogo. Use “Adotar no catálogo” no cartão dele.",
    );
  }
  return current.item.catalogConfig;
}

/** O escopo de apresentação, para as escritas que só ele aceita. */
export function requirePresentationConfig(
  current: CatalogEntryWithConfig,
): IndexCatalogPresentationConfigV2 {
  if (!isPresentationManagedCatalogConfig(current.item.catalogConfig)) {
    throw new Error(
      "Esta operação existe apenas para índices legados adotados no escopo de apresentação.",
    );
  }
  return current.item.catalogConfig;
}
