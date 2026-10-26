import "server-only";

import { isMunicipalSpreadsheetSource } from "@/contracts/municipalSpreadsheet";
import {
  getGeeStatisticsMunicipalitiesYearValues,
  getGeeStatisticsYearPatch,
} from "@/repositories/platform/geeStatisticsRepository";
import { getOrLoadSpreadsheetSnapshot } from "@/repositories/platform/municipalSpreadsheetSnapshotCache";
import type { TerritoryRankingData } from "@/utils/analysis";
import { isCompactImageData } from "@/utils/imageData";
import type { PanelLayerI } from "@/utils/interfaces";
import { getTerritoryRankingScope } from "@/utils/territoryRankingScope";

async function readSpreadsheetValues(
  snapshotUrl: string,
  yearKey: string,
): Promise<Record<string, number[]>> {
  const snapshot = await getOrLoadSpreadsheetSnapshot(snapshotUrl);
  const position = snapshot.periods.indexOf(yearKey);
  const values: Record<string, number[]> = {};
  if (position < 0) return values;

  for (const [locationKey, list] of Object.entries(snapshot.values)) {
    const value = list[position];
    if (value !== null && value !== undefined) values[locationKey] = [value];
  }
  return values;
}

/**
 * Os valores dos territórios que um recorte lista em "Territórios por
 * classificação", num período.
 *
 * Os estados de uma região saem da mesma leitura do recorte nacional, que o
 * painel do Brasil já usa; os municípios saem de uma leitura do país inteiro
 * no período, recortada aqui. Devolve `null` quando o recorte não tem lista
 * (Brasil e município) ou quando a fonte da camada não sabe responder.
 *
 * @example
 * await getTerritoryRanking(layer, "2025-06", "3_bioma-caatinga");
 * // { entity: "municipalities", values: { "2100055": [0, 100, 0, 0, 0, 0], ... } }
 */
export async function getTerritoryRanking(
  panelLayer: PanelLayerI,
  yearKey: string,
  locationKey: string,
): Promise<TerritoryRankingData | null> {
  const scope = getTerritoryRankingScope(locationKey);
  const imageData = panelLayer.imageData;

  if (!scope || !isCompactImageData(imageData)) {
    return null;
  }

  if (!imageData.years[yearKey]) {
    return { entity: scope.entity, values: {} };
  }

  const source = panelLayer.statisticsSource ?? null;
  const classCount = imageData.classes.length;
  const periodKeys = Object.keys(imageData.years);
  let allValues: Record<string, number[]> | null | undefined;

  if (isMunicipalSpreadsheetSource(source)) {
    if (!source.snapshot?.url) return null;
    allValues = await readSpreadsheetValues(source.snapshot.url, yearKey);
  } else if (scope.entity === "states") {
    const result = await getGeeStatisticsYearPatch(
      panelLayer.id,
      yearKey,
      "br",
      classCount,
      source,
      periodKeys,
    );
    allValues = result?.patch.years?.[yearKey]?.values;
  } else {
    allValues = await getGeeStatisticsMunicipalitiesYearValues(
      panelLayer.id,
      yearKey,
      classCount,
      source,
      periodKeys,
    );
  }

  if (!allValues) {
    return null;
  }

  const values: Record<string, number[]> = {};
  for (const key of scope.locationKeys) {
    const value = allValues[key];
    if (value) values[key] = value;
  }
  return { entity: scope.entity, values };
}
