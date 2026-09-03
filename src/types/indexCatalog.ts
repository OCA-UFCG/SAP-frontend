import type {
  GeeFeatureCollectionStatisticsSource,
  PublishedGeeStatisticsSource,
} from "@/contracts/geeStatistics";
import type {
  MunicipalReportData,
  MunicipalReportDocsContent,
} from "@/contracts/municipalReport";
import type { PublishedPanelLayerReportConfig } from "@/contracts/panelLayerReport";
import type {
  CompactMapVisualizationConfig,
  CompactTerritorialAnalysisDataset,
} from "@/utils/analysis";

export const INDEX_CATEGORIES = [
  "Dados Climáticos",
  "Dados Ambientais",
  "Dados Socioeconômicos",
] as const;

export type IndexCategory = (typeof INDEX_CATEGORIES)[number];

export interface ClassMapping {
  /** Index from perc_classe_XX/area_ha_classe_XX. */
  classIndex: number;
  id: string;
  label: string;
  color: string;
  pixelValue?: number;
}

export type EarthEngineSourceType =
  "image" | "imageCollection" | "featureCollection";

export interface ForecastImageCollectionSelection {
  type: "latest-emission-leads";
  emissionProperty: string;
  leadProperty: string;
  targetDateProperty: string;
  leadValues: number[];
}

/** Map rendering is deliberately independent from the statistics table. */
export interface EarthEngineAssetMapping {
  strategy: "single" | "perPeriod";
  sourceType: EarthEngineSourceType;
  singleAssetId?: string;
  assetPattern?: string;
  assetsByPeriod?: Record<string, string>;
  band?: string;
  property?: string;
  thresholds?: number[];
  collectionSelection?: ForecastImageCollectionSelection;
}

export interface CatalogValidationIssue {
  code: string;
  message: string;
  assetId?: string;
  period?: string;
}

export interface CatalogValidationReport {
  validatedAt: string;
  valid: boolean;
  errors: CatalogValidationIssue[];
  warnings: CatalogValidationIssue[];
  inferred: {
    panelLayerId: string;
    periods: string[];
    defaultPeriod?: string;
    timeScale?: "Anual" | "Mensal";
    classIndexes: number[];
    statisticsAssetCount: number;
    imageDataBytes?: number;
  };
  sourceFingerprint: string;
}

export interface IndexCatalogDraftInput {
  name: string;
  description: string;
  category: IndexCategory;
  statisticsSource: GeeFeatureCollectionStatisticsSource;
  classes: ClassMapping[];
  earthEngine: EarthEngineAssetMapping;
}

interface IndexCatalogAuditData {
  panelLayerId: string;
  status: "draft" | "ready" | "error" | "published";
  createdBy: { uid: string; email: string | null; at: string };
  updatedBy: { uid: string; email: string | null; at: string };
  validation?: CatalogValidationReport;
  /**
   * Asset do Contentful com a imagem de prévia do mapa capturada na validação.
   * Guardamos o id para reaproveitar o mesmo asset em cada nova captura, em vez
   * de deixar um rastro de imagens órfãs no espaço.
   */
  previewMap?: { assetId: string; capturedAt: string };
  /**
   * Texto do Relatório Automático escrito no catálogo. Fica aqui, e não em
   * `IndexCatalogDraftInput`, porque não descreve os dados: mudar uma frase não
   * pode invalidar a prévia nem entrar no `sourceFingerprint` conferido na
   * publicação. É a mesma razão pela qual `previewMap` mora aqui.
   */
  report?: PublishedPanelLayerReportConfig;
  auditLog?: Array<{
    action:
      | "create"
      | "update"
      | "revalidate"
      | "preview"
      | "preview-map"
      | "report-text"
      | "publish"
      | "unpublish";
    outcome: "success" | "failure";
    uid: string;
    email: string | null;
    at: string;
    message?: string;
  }>;
}

export interface IndexCatalogConfigV2
  extends IndexCatalogDraftInput, IndexCatalogAuditData {
  schemaVersion: 2;
  /** Filled by validation and copied to panelLayer.statisticsSource. */
  validatedStatisticsSource?: PublishedGeeStatisticsSource;
}

/** Only enough of v1 is retained to identify and display it safely. */
export interface LegacyIndexCatalogConfigV1 {
  schemaVersion: 1;
  panelLayerId: string;
  status: "draft" | "ready" | "error" | "published";
  name?: string;
  description?: string;
  category?: IndexCategory;
  updatedBy?: { uid?: string; email?: string | null; at?: string };
  validation?: unknown;
  [key: string]: unknown;
}

export type IndexCatalogConfig =
  IndexCatalogConfigV2 | LegacyIndexCatalogConfigV1;

export function isIndexCatalogConfigV2(
  config: IndexCatalogConfig | null | undefined,
): config is IndexCatalogConfigV2 {
  return config?.schemaVersion === 2;
}

export interface IndexCatalogItem {
  entryId: string;
  panelLayerId: string;
  name: string;
  description: string;
  category?: string;
  panelPosition?: number;
  published: boolean;
  /**
   * True depois da primeira publicação, mesmo que a entry esteja despublicada
   * agora. É o que congela o ID técnico do panelLayer.
   */
  everPublished: boolean;
  hasUnpublishedChanges: boolean;
  /** True only for v2. V1 and entries without catalogConfig are read-only. */
  catalogManaged: boolean;
  status: "legacy" | IndexCatalogConfigV2["status"];
  catalogConfig?: IndexCatalogConfig;
}

export interface IndexCatalogLifecycleImpact {
  item: IndexCatalogItem;
  linkedEntries: [];
  counts: {
    panelLayer: 1;
    municipalAnalysis: 0;
    municipalReportSeries: 0;
    total: 1;
  };
}

export interface IndexCatalogPreview {
  entryId: string;
  panelLayer: {
    sys: { id: string };
    id: string;
    name: string;
    description: string;
    category: string;
    panelPosition?: number;
    previewMap?: { url: string } | null;
    imageData: CompactTerritorialAnalysisDataset;
    minScale?: number;
    maxScale?: number;
    timeScale?: string;
    statisticsSource: PublishedGeeStatisticsSource;
    tileApiPath: string;
    municipalAnalysisApiPath: string;
  };
  validation: CatalogValidationReport;
}

export interface IndexCatalogBuildResult {
  panelLayerImageData: CompactTerritorialAnalysisDataset;
  validation: CatalogValidationReport;
  mapVisualization: CompactMapVisualizationConfig;
  statisticsSource: PublishedGeeStatisticsSource;
  classes: ClassMapping[];
}

/**
 * Como um índice em rascunho apareceria no Relatório Automático.
 *
 * Vive nos tipos, e não no serviço, porque a tela do catálogo consome a
 * resposta: o serviço é `server-only` e importar o tipo de lá acoplaria o
 * bundle do navegador a um módulo que não pode entrar nele.
 */
export interface IndexCatalogReportPreview {
  municipality: { code: string; name: string; uf: string };
  period: string;
  report: MunicipalReportData;
  /** As seções escritas no catálogo, já com as variáveis trocadas pelos dados. */
  docsContent: MunicipalReportDocsContent;
}
