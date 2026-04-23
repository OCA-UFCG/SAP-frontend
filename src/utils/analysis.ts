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

export interface TerritorialAnalysisLocationData {
  name: string;
  accentColor?: string;
  highlight?: AnalysisHighlight;
  happening?: string;
  distribution?: AnalysisDistributionItem[];
  rankingTitle?: string;
  rankingGroups?: AnalysisRankingGroup[];
}

export interface LegacyTerritorialAnalysisDataset {
  schemaVersion: number;
  type: "territorial";
  locations: Record<string, TerritorialAnalysisLocationData>;
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

export type TerritorialAnalysisDataset =
  | LegacyTerritorialAnalysisDataset
  | CompactTerritorialAnalysisDataset;

export interface LayerAnalysisConfig {
  type: "territorial" | string;
  source?: string;
  data?: TerritorialAnalysisDataset;
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
