import type {
  IndexCatalogConfigV2,
  IndexCatalogPresentationConfigV2,
  ManagedIndexCatalogConfig,
} from "@/types/indexCatalog";

export const INDEX_CATALOG_CATEGORIES: readonly [
  "Dados Climáticos",
  "Dados Ambientais",
  "Dados Socioeconômicos",
];

export type CatalogAuditEvent = NonNullable<
  IndexCatalogConfigV2["auditLog"]
>[number];

export function appendCatalogAuditEvent<T extends ManagedIndexCatalogConfig>(
  config: T,
  event: CatalogAuditEvent,
): T;

export function buildPublishedPresentationConfig(input: {
  config: IndexCatalogPresentationConfigV2;
  actor: { uid: string; email: string | null };
  at: string;
}): IndexCatalogPresentationConfigV2;
