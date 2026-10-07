import type { MunicipalSpreadsheetStatisticsSource } from "@/contracts/municipalSpreadsheet";
import type { MunicipalSpreadsheetSnapshot } from "@/contracts/municipalSpreadsheetSnapshot";
import { getOrLoadSpreadsheetSnapshot } from "@/repositories/platform/municipalSpreadsheetSnapshotCache";
import { shouldIncludeLocation } from "@/utils/statisticsLocationScope";
import type { CompactTerritorialAnalysisDatasetPatch } from "@/utils/municipalAnalysisMerge";

export interface MunicipalSpreadsheetYearResult {
  patch: CompactTerritorialAnalysisDatasetPatch;
  snapshotUrl: string;
}

function requireSnapshotUrl(source: MunicipalSpreadsheetStatisticsSource) {
  const url = source.snapshot?.url;
  if (!url) {
    throw new Error(
      `O índice de planilha ${source.fileId} não tem instantâneo publicado; revalide-o no catálogo.`,
    );
  }
  return url;
}

/**
 * O patch `territorial-compact` de um período a partir do instantâneo.
 *
 * A camada tem uma classe só — o próprio indicador —, então cada território
 * entra como um vetor de um valor. Um território sem valor não vira entrada: o
 * painel trata a ausência como "sem dado", que é o certo para o município que
 * não existia no ano ou não foi medido.
 */
export function buildSpreadsheetYearPatch(
  snapshot: MunicipalSpreadsheetSnapshot,
  yearKey: string,
  requestedLocationKey: string,
): CompactTerritorialAnalysisDatasetPatch {
  const position = snapshot.periods.indexOf(yearKey);
  const locations: Record<string, string> = {};
  const values: Record<string, number[]> = {};

  for (const [locationKey, label] of Object.entries(snapshot.locations)) {
    if (!shouldIncludeLocation(requestedLocationKey, locationKey)) continue;
    locations[locationKey] = label;
    const value =
      position < 0 ? null : snapshot.values[locationKey]?.[position];
    if (value !== null && value !== undefined) values[locationKey] = [value];
  }

  return { locations, years: { [yearKey]: { valuesScale: 1, values } } };
}

/**
 * Os valores de um período e território de um índice criado a partir de
 * planilha.
 *
 * Não há nenhuma chamada ao Earth Engine aqui: o instantâneo já traz todos os
 * recortes calculados, e a leitura é um recorte de objeto em memória.
 *
 * @example
 * await getSpreadsheetYearPatch(source, "2023", "pb");
 */
export async function getSpreadsheetYearPatch(
  source: MunicipalSpreadsheetStatisticsSource,
  yearKey: string,
  locationKey: string,
): Promise<MunicipalSpreadsheetYearResult> {
  const snapshotUrl = requireSnapshotUrl(source);
  const snapshot = await getOrLoadSpreadsheetSnapshot(snapshotUrl);

  return {
    patch: buildSpreadsheetYearPatch(snapshot, yearKey, locationKey),
    snapshotUrl,
  };
}

/**
 * O valor de cada município num período, que é o que o mapa precisa para pintar
 * a coropleta.
 *
 * Vai como `{ código: valor }` e não como lista de objetos: são mais de cinco
 * mil municípios, e a resposta trafega em cada troca de período.
 *
 * Separado da leitura do asset porque a prévia do catálogo chega aqui com o
 * instantâneo em memória, lido da planilha e ainda não publicado.
 *
 * @example
 * selectMunicipalSpreadsheetValues(snapshot, "2023")["2507507"]; // 12345
 */
export function selectMunicipalSpreadsheetValues(
  snapshot: MunicipalSpreadsheetSnapshot,
  yearKey: string,
): Record<string, number> {
  const position = snapshot.periods.indexOf(yearKey);
  if (position < 0) return {};

  const values: Record<string, number> = {};
  for (const [locationKey, list] of Object.entries(snapshot.values)) {
    const value = list[position];
    if (/^\d{7}$/u.test(locationKey) && value !== null && value !== undefined) {
      values[locationKey] = value;
    }
  }
  return values;
}

export async function getSpreadsheetMunicipalValues(
  source: MunicipalSpreadsheetStatisticsSource,
  yearKey: string,
): Promise<Record<string, number>> {
  const snapshot = await getOrLoadSpreadsheetSnapshot(
    requireSnapshotUrl(source),
  );
  return selectMunicipalSpreadsheetValues(snapshot, yearKey);
}
