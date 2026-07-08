export type MunicipalReportAnalysisStatus =
  | "available"
  | "unavailable"
  | "period_not_found";

export interface MunicipalReportClass {
  id: string;
  label: string;
  color: string;
  tone?: { color: string; bg: string; border: string };
}

export interface MunicipalReportDistributionItem extends MunicipalReportClass {
  percentage: number;
}

export interface MunicipalReportPeriodSnapshot {
  period: string;
  label: string;
  distribution: MunicipalReportDistributionItem[];
  dominantClass: MunicipalReportDistributionItem | null;
}

export interface MunicipalReportAnalysis {
  id: string;
  alias: string;
  title: string;
  unit: "%";
  status: MunicipalReportAnalysisStatus;
  requestedPeriod: string;
  effectivePeriod: string | null;
  classes: MunicipalReportClass[];
  snapshot: MunicipalReportPeriodSnapshot | null;
  timeSeries: MunicipalReportPeriodSnapshot[];
}

export type MunicipalReportTemplateValue = string | number | null;

export type MunicipalReportTemplateVariableType =
  | "string"
  | "number"
  | "percentage"
  | "period";

export interface MunicipalReportTemplateVariableDefinition {
  name: string;
  type: MunicipalReportTemplateVariableType;
  description: string;
  example: Exclude<MunicipalReportTemplateValue, null> | "indisponível";
}

export interface MunicipalReportTemplateDocument {
  id: string;
  version: string;
  origin: "local" | "google-docs";
  updatedAt: string;
  text: string;
}

export interface MunicipalReportContentSection {
  key: string;
  scope: "report" | "analysis";
  analysisAlias?: string;
  slot: string;
  originalText: string;
  resolvedText: string | null;
  errors: string[];
}

export interface MunicipalReportContent {
  template: Omit<MunicipalReportTemplateDocument, "text">;
  sections: MunicipalReportContentSection[];
  errors: string[];
}

export interface MunicipalReportPackage {
  report: MunicipalReportData;
  content: MunicipalReportContent;
}

export interface MunicipalReportChartImage {
  analysisId: string;
  alias: string;
  title: string;
  period: string | null;
  contentType: "image/svg+xml";
  base64: string;
}

export interface MunicipalReportData {
  schemaVersion: 1;
  generatedAt: string;
  requestedPeriod: string;
  municipality: { code: string; name: string; uf: string };
  analyses: MunicipalReportAnalysis[];
  templateVariables: Record<string, MunicipalReportTemplateValue>;
}
