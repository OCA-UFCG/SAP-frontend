export type MunicipalReportAnalysisStatus =
  "available" | "unavailable" | "period_not_found";

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
  category?: string;
  unit: string;
  valueType: "percentage" | "absolute";
  status: MunicipalReportAnalysisStatus;
  requestedPeriod: string;
  effectivePeriod: string | null;
  classes: MunicipalReportClass[];
  snapshot: MunicipalReportPeriodSnapshot | null;
  timeSeries: MunicipalReportPeriodSnapshot[];
  /**
   * Cor do cabeçalho e nota de metodologia escritas no catálogo. Presente só
   * nos índices que as publicaram; os legados seguem lendo
   * `MUNICIPAL_REPORT_LAYERS`, que o cliente já conhece. Campo aditivo e
   * opcional: um consumidor da v1 que o ignore continua correto.
   */
  presentation?: { sectionColor?: string; methodology?: string };
}

export type MunicipalReportTemplateValue = string | number | null;

export type MunicipalReportTemplateVariableType =
  "string" | "number" | "percentage" | "period";

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

export interface MunicipalReportDocsSection {
  title: string;
  text: string;
}

export const MUNICIPAL_REPORT_DOCS_REPORT_KEY = "__report__";

export type MunicipalReportDocsContent = Record<
  string,
  MunicipalReportDocsSection[]
>;

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

export type MunicipalReportTerritoryLevel =
  | "municipality"
  | "state"
  | "region"
  | "biome"
  | "asd"
  | "semiarid"
  | "national";

/**
 * O território descrito pelo relatório, em todas as grafias que o documento
 * usa: o título leva `label`, as frases escritas no catálogo levam
 * `prepositionalLabel` e a leitura no Earth Engine leva `locationKey`.
 *
 * @example
 * const territory: MunicipalReportTerritory = {
 *   locationKey: "3_bioma-caatinga",
 *   level: "biome",
 *   name: "Caatinga",
 *   label: "Caatinga",
 *   kindLabel: "bioma",
 *   prepositionalLabel: "No bioma Caatinga",
 *   possessiveLabel: "do bioma Caatinga",
 * };
 */
export interface MunicipalReportTerritory {
  locationKey: string;
  level: MunicipalReportTerritoryLevel;
  name: string;
  label: string;
  kindLabel: string;
  prepositionalLabel: string;
  possessiveLabel: string;
  uf?: string;
}

/**
 * Versão do contrato `MunicipalReportData`. Existe como constante para quem
 * valida um relatório vindo de fora do processo — hoje o cache em disco, que
 * precisa recusar um arquivo gravado por uma versão anterior do contrato.
 */
export const MUNICIPAL_REPORT_SCHEMA_VERSION = 1;

export interface MunicipalReportData {
  schemaVersion: 1;
  generatedAt: string;
  requestedPeriod: string;
  territory: MunicipalReportTerritory;
  /**
   * Presente só no relatório de um município. Campo mantido da v1 para os
   * consumidores que dependem do código IBGE — o recorte territorial do
   * relatório está em `territory`, que existe em todos eles.
   */
  municipality?: { code: string; name: string; uf: string };
  analyses: MunicipalReportAnalysis[];
  templateVariables: Record<string, MunicipalReportTemplateValue>;
}
