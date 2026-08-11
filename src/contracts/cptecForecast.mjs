export const CPTEC_FORECAST_PANEL_LAYER_ID = "prev_anomalia_precipitacao";
export const CPTEC_FORECAST_COLLECTION_ID =
  "projects/ee-ulissesalencar17/assets/CPTEC_Prev_P_Anomalia";
export const CPTEC_FORECAST_EMISSION_PROPERTY = "data_emissao";
export const CPTEC_FORECAST_LEAD_PROPERTY = "lead_time";

export const CPTEC_FORECAST_THRESHOLDS = Object.freeze([-90, -30, 0, 30, 90]);
export const CPTEC_FORECAST_PALETTE = Object.freeze([
  "#a50026",
  "#f46d43",
  "#fee090",
  "#abd9e9",
  "#4575b4",
  "#313695",
]);

export const CPTEC_FORECAST_CLASSES = Object.freeze([
  Object.freeze({
    id: "muito-abaixo",
    label: "0 — Muito abaixo do normal",
    color: CPTEC_FORECAST_PALETTE[0],
    pixelLimit: 0,
  }),
  Object.freeze({
    id: "abaixo",
    label: "1 — Abaixo do normal",
    color: CPTEC_FORECAST_PALETTE[1],
    pixelLimit: 1,
  }),
  Object.freeze({
    id: "levemente-abaixo",
    label: "2 — Levemente abaixo",
    color: CPTEC_FORECAST_PALETTE[2],
    pixelLimit: 2,
  }),
  Object.freeze({
    id: "levemente-acima",
    label: "3 — Levemente acima",
    color: CPTEC_FORECAST_PALETTE[3],
    pixelLimit: 3,
  }),
  Object.freeze({
    id: "acima",
    label: "4 — Acima do normal",
    color: CPTEC_FORECAST_PALETTE[4],
    pixelLimit: 4,
  }),
  Object.freeze({
    id: "muito-acima",
    label: "5 — Muito acima do normal",
    color: CPTEC_FORECAST_PALETTE[5],
    pixelLimit: 5,
  }),
]);

export function buildCptecForecastMapVisualization() {
  return {
    sourceType: "imageCollection",
    min: 0,
    max: 5,
    outputBand: "Classe_Previsao",
    thresholds: [...CPTEC_FORECAST_THRESHOLDS],
    palette: [...CPTEC_FORECAST_PALETTE],
    legend: CPTEC_FORECAST_CLASSES.map((forecastClass) => ({
      ...forecastClass,
    })),
  };
}

export function getCptecForecastCollectionSelection(imageId, leadTime) {
  if (
    imageId !== CPTEC_FORECAST_COLLECTION_ID ||
    !Number.isInteger(leadTime) ||
    leadTime < 1
  ) {
    return undefined;
  }

  return {
    latestProperty: CPTEC_FORECAST_EMISSION_PROPERTY,
    filterProperty: CPTEC_FORECAST_LEAD_PROPERTY,
    filterValue: leadTime,
    sortProperty: CPTEC_FORECAST_LEAD_PROPERTY,
    selectFirstBand: true,
  };
}
