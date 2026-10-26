import "server-only";

import { isGeeMunicipalValueTableSource } from "@/contracts/geeMunicipalValueTable";
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

// Avisa uma vez por camada, período e recorte, e não a cada pedido.
const reportedMissingRankings = new Set<string>();

/**
 * Um município sem linha válida na tabela por classes sai da lista sem erro no
 * painel (célula vazia, que o Earth Engine descarta, ou percentuais que não
 * somam 100). O aviso no log é o que deixa isso visível para quem mantém a
 * tabela.
 */
function reportMissingMunicipalities(
  panelLayerId: string,
  yearKey: string,
  locationKey: string,
  missingCodes: string[],
) {
  const reportKey = `${panelLayerId}::${yearKey}::${locationKey}`;
  if (missingCodes.length === 0 || reportedMissingRankings.has(reportKey)) {
    return;
  }

  reportedMissingRankings.add(reportKey);
  console.warn(
    `[territoryRanking] ${missingCodes.length} município(s) de ${locationKey} sem linha válida em ${panelLayerId}/${yearKey}, fora da lista: ${missingCodes.slice(0, 20).join(", ")}${missingCodes.length > 20 ? ", …" : ""}`,
  );
}

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
  const missingCodes: string[] = [];
  for (const key of scope.locationKeys) {
    const value = allValues[key];
    if (value) values[key] = value;
    else missingCodes.push(key);
  }

  // Na planilha e na tabela de valor único a ausência é dado que falta (o
  // município não existia no ano); só a tabela por classes tem uma linha para
  // cada município.
  if (
    scope.entity === "municipalities" &&
    !isMunicipalSpreadsheetSource(source) &&
    !isGeeMunicipalValueTableSource(source)
  ) {
    reportMissingMunicipalities(
      panelLayer.id,
      yearKey,
      locationKey,
      missingCodes,
    );
  }

  return { entity: scope.entity, values };
}
