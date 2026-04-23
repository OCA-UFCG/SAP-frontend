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
  color?: string | null;
}

export interface AnalysisTemporalPoint {
  id: string;
  label: string;
  shortLabel?: string;
  color: string;
}

export interface AnalysisTemporalSection {
  id: string;
  title: string;
  description?: string;
  points: AnalysisTemporalPoint[];
  legend?: Array<Pick<AnalysisDistributionItem, "id" | "label" | "color">>;
}

export interface TerritorialAnalysisLocationData {
  name: string;
  accentColor?: string;
  highlight?: AnalysisHighlight;
  happening?: string;
  distribution?: AnalysisDistributionItem[];
  rankingTitle?: string;
  rankingGroups?: AnalysisRankingGroup[];
  temporalSections?: AnalysisTemporalSection[];
}

export interface TerritorialAnalysisDataset {
  schemaVersion: number;
  type: "territorial";
  locations: Record<string, TerritorialAnalysisLocationData>;
}

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
  temporalSections: AnalysisTemporalSection[];
}