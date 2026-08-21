import type { AuthenticatedUserSession } from "@/lib/server-session";
import {
  isIndexCatalogConfigV2,
  type IndexCatalogConfig,
  type IndexCatalogConfigV2,
} from "@/types/indexCatalog";

export function catalogTimestamp() {
  return new Date().toISOString();
}

/** Toda escrita no catálogo deixa rastro de quem fez, quando e com que efeito. */
export function withAuditEvent(
  config: IndexCatalogConfigV2,
  user: AuthenticatedUserSession,
  event: {
    action: NonNullable<IndexCatalogConfigV2["auditLog"]>[number]["action"];
    outcome: "success" | "failure";
    message?: string;
  },
): IndexCatalogConfigV2 {
  return {
    ...config,
    auditLog: [
      ...(config.auditLog ?? []),
      { ...event, uid: user.uid, email: user.email, at: catalogTimestamp() },
    ].slice(-50),
  };
}

/**
 * Só um `catalogConfig` v2 pode ser gerenciado pelo catálogo. Entries legadas
 * seguem visíveis para consulta, mas nenhuma mutação pode tocá-las.
 */
export function requireManagedConfig(current: {
  item: { catalogConfig?: IndexCatalogConfig };
}) {
  if (!isIndexCatalogConfigV2(current.item.catalogConfig)) {
    throw new Error(
      "Este índice é legado e está disponível apenas para consulta. Crie um índice v2 para gerenciá-lo pelo catálogo.",
    );
  }
  return current.item.catalogConfig;
}
