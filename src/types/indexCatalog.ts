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

export type DriveSourceRole =
  "panel" | "municipal" | "multilevel" | "state" | "unsupported";

export interface DriveFileInspection {
  role: DriveSourceRole;
  columns: string[];
  periods: string[];
  classColumns: string[];
  warnings: string[];
}

export interface DriveFileCandidate {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  inspection: DriveFileInspection;
}

export type DriveSourceSelection = DriveFileCandidate;

export interface ClassMapping {
  column: string;
  id: string;
  label: string;
  color: string;
  pixelValue?: number;
}

export type EarthEngineSourceType =
  "image" | "imageCollection" | "featureCollection";

export interface EarthEngineAssetMapping {
  strategy: "single" | "perPeriod";
  sourceType: EarthEngineSourceType;
  singleAssetId?: string;
  assetPattern?: string;
  assetsByPeriod?: Record<string, string>;
  band?: string;
  property?: string;
  continuousValues?: boolean;
  thresholds?: number[];
}

export interface CatalogValidationIssue {
  code: string;
  message: string;
  fileId?: string;
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
    locations: number;
    municipalLocations: number;
    panelSourceCount: number;
    municipalSourceCount: number;
    imageDataBytes?: number;
  };
  sourceFingerprint: string;
}

export interface IndexCatalogDraftInput {
  name: string;
  description: string;
  category: IndexCategory;
  sourceTag: string;
  selectedFiles: DriveSourceSelection[];
  valueType: "percentage" | "absolute";
  unit: string;
  classes: ClassMapping[];
  earthEngine: EarthEngineAssetMapping;
}

export interface IndexCatalogConfig extends IndexCatalogDraftInput {
  schemaVersion: 1;
  panelLayerId: string;
  status: "draft" | "ready" | "error" | "published";
  createdBy: {
    uid: string;
    email: string | null;
    at: string;
  };
  updatedBy: {
    uid: string;
    email: string | null;
    at: string;
  };
  validation?: CatalogValidationReport;
  derivedEntryIds?: string[];
  auditLog?: Array<{
    action: "create" | "update" | "preview" | "publish" | "unpublish";
    outcome: "success" | "failure";
    uid: string;
    email: string | null;
    at: string;
    message?: string;
  }>;
}

export interface IndexCatalogItem {
  entryId: string;
  panelLayerId: string;
  name: string;
  description: string;
  category?: string;
  panelPosition?: number;
  published: boolean;
  hasUnpublishedChanges: boolean;
  catalogManaged: boolean;
  status: "legacy" | IndexCatalogConfig["status"];
  catalogConfig?: IndexCatalogConfig;
}

export interface IndexCatalogLinkedEntry {
  entryId: string;
  contentType: "municipalAnalysis" | "municipalReportSeries";
  title: string;
  published: boolean;
}

export interface IndexCatalogLifecycleImpact {
  item: IndexCatalogItem;
  linkedEntries: IndexCatalogLinkedEntry[];
  counts: {
    panelLayer: 1;
    municipalAnalysis: number;
    municipalReportSeries: number;
    total: number;
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
    previewMap?: {
      url: string;
      title?: string;
      width?: number;
      height?: number;
    } | null;
    imageData: CompactTerritorialAnalysisDataset;
    minScale?: number;
    maxScale?: number;
    timeScale?: string;
    tileApiPath: string;
    municipalAnalysisApiPath: string;
  };
  validation: CatalogValidationReport;
}

export interface IndexCatalogBuildResult {
  panelLayerImageData: CompactTerritorialAnalysisDataset;
  partitions: Array<{
    partitionKey: string;
    calendarYear?: string;
    territory: string;
    imageData: unknown;
  }>;
  validation: CatalogValidationReport;
  mapVisualization: CompactMapVisualizationConfig;
}
