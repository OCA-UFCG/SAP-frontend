import type { ForecastSelection } from "@/utils/forecastGroup";

/**
 * A previsão que o cartão "Previsão climática" liga quando ninguém escolheu
 * outra. Se a combinação deixar de existir, vale a mais próxima dela — a mesma
 * regra de quando um filtro escolhido some (`resolveForecastSelection`).
 */
export const DEFAULT_FORECAST_SELECTION: ForecastSelection = {
  source: "INMET",
  variable: "Precipitação",
  periodicity: "monthly",
  kind: "Anomalia",
};
