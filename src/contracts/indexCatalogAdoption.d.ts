import type { PublishedPanelLayerReportConfig } from "@/contracts/panelLayerReport";
import type {
  IndexCatalogConfig,
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

export function resolveAdoptedCategory(
  category: string | undefined,
): (typeof INDEX_CATALOG_CATEGORIES)[number];

/** O que a adoção precisa ler da entry legada, e nada além disso. */
export interface AdoptablePanelLayerFields {
  panelLayerId: string;
  name: string;
  description: string;
  category?: string;
  measurementUnit?: string;
  panelPosition?: number;
  published: boolean;
  catalogConfig?: IndexCatalogConfig;
}

export function buildAdoptedPresentationConfig(input: {
  item: AdoptablePanelLayerFields;
  reportConfig?: PublishedPanelLayerReportConfig | null;
  actor: { uid: string; email: string | null };
  at: string;
}): IndexCatalogPresentationConfigV2;
