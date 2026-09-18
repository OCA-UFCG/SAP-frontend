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
  tone: AnalysisTone;
  total: number;
  totalLabel: string;
  items: AnalysisRankingEntry[];
  allItems?: AnalysisRankingEntry[];
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
  municipality?: string;
  highlight?: string;
}

export interface CompactAnalysisRankingConfig {
  title?: string;
  totalLabel?: string;
}

export interface CompactAnalysisValueConfig {
  type?: "percentage" | "absolute";
  unit?: string;
  distributionTitle?: string;
}

export interface CompactImageCollectionSelectionConfig {
  latestProperty: string;
  latestValue?: string | number;
  filterProperty: string;
  sortProperty?: string;
  selectFirstBand?: boolean;
}

export interface ResolvedImageCollectionSelection extends CompactImageCollectionSelectionConfig {
  filterValue: string | number;
}

/**
 * Janela de tempo do período pedido, usada para escolher uma imagem dentro de
 * uma `ImageCollection` que não declara `imageCollectionSelection`.
 *
 * `property`/`value` são o escape hatch para assets cuja data (`system:time_start`)
 * não é confiável: quando presentes, a filtragem usa a etiqueta em vez da data.
 */
export interface ResolvedImageCollectionPeriod {
  startMillis: number;
  endMillis: number;
  property?: string;
  value?: string;
}

export interface CompactMapVisualizationConfig {
  sourceType?:
    | "image"
    | "imageCollection"
    | "featureCollection"
    /** Coropleta municipal pintada no navegador, sem asset do Earth Engine. */
    | "municipalChoropleth";
  min?: number;
  max?: number;
  palette?: string[];
  legend?: CompactAnalysisClass[];
  band?: string;
  sourceBand?: string;
  outputBand?: string;
  property?: string;
  outline?: {
    color?: string;
    width?: number;
    opacity?: number;
  };
  thresholds?: number[];
  sourceRange?: {
    min?: number;
    max?: number;
    unit?: string;
  };
  valueMeaning?: Record<string, string>;
  imageCollectionSelection?: CompactImageCollectionSelectionConfig;
  /**
   * Etiqueta do ano/período de cada imagem da coleção (`ano_fim_janela`, `ano`,
   * ...). Só precisa ser preenchida quando `system:time_start` do asset não
   * corresponde ao período exibido; sem ela a escolha é feita pela data.
   */
  imageCollectionPeriodProperty?: string;
}

export interface CompactAnalysisYearData {
  /**
   * Ausente nos índices cujo mapa é uma coropleta municipal: não há asset do
   * Earth Engine por trás dela, e o período é desenhado a partir dos valores.
   */
  imageId?: string;
  year?: string;
  leadTime?: number;
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
  valueConfig?: CompactAnalysisValueConfig;
  mapVisualization?: CompactMapVisualizationConfig;
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
  valueType?: "percentage" | "absolute";
  valueUnit?: string;
  distributionTitle?: string;
}
