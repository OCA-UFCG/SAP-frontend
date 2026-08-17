import type {
  CompactAnalysisClass,
  CompactMapVisualizationConfig,
} from "@/utils/analysis";

export const CPTEC_FORECAST_PANEL_LAYER_ID: "prev_anomalia_precipitacao";
export const CPTEC_FORECAST_COLLECTION_ID: "projects/ee-ulissesalencar17/assets/CPTEC_Prev_P_Anomalia";
export const CPTEC_FORECAST_EMISSION_PROPERTY: "data_emissao";
export const CPTEC_FORECAST_LEAD_PROPERTY: "lead_time";
export const CPTEC_FORECAST_THRESHOLDS: readonly number[];
export const CPTEC_FORECAST_PALETTE: readonly string[];
export const CPTEC_FORECAST_CLASSES: readonly Readonly<CompactAnalysisClass>[];

export function buildCptecForecastMapVisualization(): CompactMapVisualizationConfig;

export interface CptecForecastCollectionSelection {
  latestProperty: typeof CPTEC_FORECAST_EMISSION_PROPERTY;
  filterProperty: typeof CPTEC_FORECAST_LEAD_PROPERTY;
  filterValue: number;
  sortProperty: typeof CPTEC_FORECAST_LEAD_PROPERTY;
  selectFirstBand: true;
}

export function getCptecForecastCollectionSelection(
  imageId: string,
  leadTime?: number,
): CptecForecastCollectionSelection | undefined;
