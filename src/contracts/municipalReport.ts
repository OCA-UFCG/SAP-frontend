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

export interface MunicipalReportData {
  schemaVersion: 1;
  generatedAt: string;
  requestedPeriod: string;
  municipality: { code: string; name: string; uf: string };
  analyses: MunicipalReportAnalysis[];
  templateVariables: Record<string, MunicipalReportTemplateValue>;
}
