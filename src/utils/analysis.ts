export interface AnalysisYearOption {
  value: string;
  label: string;
}

export interface AnalysisTone {
  color: string;
  bg: string;
  border: string;
}

export interface AnalysisDistributionItem {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface AnalysisHighlight {
  label: string;
  text: string;
  tone: AnalysisTone;
}

export interface AnalysisRankingEntry {
  id: string;
  label: string;
  trailingLabel?: string;
}

export interface AnalysisRankingGroup {
  id: string;
  label: string;
  total: number;
  totalLabel: string;
  items: AnalysisRankingEntry[];
}

export interface CompactAnalysisClass {
  id: string;
  label: string;
  color: string;
  tone?: AnalysisTone;
  pixelLimit?: number;
}

export interface CompactAnalysisTemplates {
  country?: string;
  state?: string;
  highlight?: string;
}

export interface CompactAnalysisRankingConfig {
  title?: string;
  totalLabel?: string;
}

export interface CompactAnalysisYearData {
  imageId: string;
  year?: string;
  valuesScale?: number;
  values: Record<string, number[]>;
}

export interface CompactTerritorialAnalysisDataset {
  schemaVersion: number;
  type: "territorial-compact";
  defaultYear?: string;
  classes: CompactAnalysisClass[];
  locations?: Record<string, string>;
  templates?: CompactAnalysisTemplates;
  ranking?: CompactAnalysisRankingConfig;
  years: Record<string, CompactAnalysisYearData>;
}

export interface LayerAnalysisConfig {
  type: "territorial" | string;
  source?: string;
  data?: CompactTerritorialAnalysisDataset;
}

export interface TerritorialAnalysisViewModel {
  kind: "territorial";
  name: string;
  accentColor: string;
  highlight: AnalysisHighlight | null;
  happening: string;
  distribution: AnalysisDistributionItem[];
  rankingTitle?: string;
  rankingGroups: AnalysisRankingGroup[];
}
