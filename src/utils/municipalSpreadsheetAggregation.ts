import {
  buildSpatialLocationKey,
  SPATIAL_LOCATION_NAMES,
} from "@/contracts/spatialLocationKey.mjs";
import type { MunicipalSpreadsheetAggregation } from "@/contracts/municipalSpreadsheet";
import type { MunicipalSpreadsheetSnapshot } from "@/contracts/municipalSpreadsheetSnapshot";
import { MUNICIPAL_SPREADSHEET_SNAPSHOT_TYPE } from "@/contracts/municipalSpreadsheetSnapshot";
import { getStateLabel, resolveGeeStateCode } from "@/utils/geeStateCode";
import type { MunicipalSpreadsheetRow } from "@/utils/municipalSpreadsheetTable";

/**
 * Um território agregado em construção: a soma e a contagem de cada período,
 * das quais saem tanto a soma quanto a média.
 */
interface TerritoryAccumulator {
  label: string;
  sums: number[];
  counts: number[];
}

export interface MunicipalSpreadsheetAggregationResult {
  snapshot: MunicipalSpreadsheetSnapshot;
  /** Quantos municípios ficaram sem valor em cada período, para o aviso da validação. */
  missingByPeriod: Record<string, number>;
  /** Municípios cuja UF a planilha não soube dizer; ficam fora do ranking de estados. */
  unknownStateCount: number;
}

function createAccumulator(label: string, periodCount: number) {
  return {
    label,
    sums: new Array<number>(periodCount).fill(0),
    counts: new Array<number>(periodCount).fill(0),
  };
}

function accumulate(
  territories: Map<string, TerritoryAccumulator>,
  locationKey: string,
  label: string,
  values: readonly (number | null)[],
) {
  const entry =
    territories.get(locationKey) ?? createAccumulator(label, values.length);
  values.forEach((value, position) => {
    if (value === null) return;
    entry.sums[position] += value;
    entry.counts[position] += 1;
  });
  territories.set(locationKey, entry);
}

/**
 * As chaves agregadas a que um município pertence, segundo as colunas da
 * convenção.
 *
 * Um município pode entrar em vários recortes ao mesmo tempo — um município do
 * Ceará no semiárido e na ASD conta nos dois —, e é por isso que a função
 * devolve uma lista em vez de um recorte só.
 */
function resolveAggregateKeys(
  row: MunicipalSpreadsheetRow,
): Array<[string, string]> {
  const keys: Array<[string, string]> = [["br", "Brasil"]];

  if (row.region) {
    keys.push([buildSpatialLocationKey("2_Regiao", row.region), row.region]);
  }
  if (row.biome) {
    keys.push([buildSpatialLocationKey("3_Bioma", row.biome), row.biome]);
  }
  if (row.isAsdOrSurroundings) {
    const name = SPATIAL_LOCATION_NAMES.asdAndSurroundings;
    keys.push([buildSpatialLocationKey("4_ASD", name), name]);
  }
  if (row.isSemiarid) {
    const name = SPATIAL_LOCATION_NAMES.semiarid;
    keys.push([buildSpatialLocationKey("5_Semiarido", name), name]);
  }

  return keys;
}

function resolveValue(
  entry: TerritoryAccumulator,
  position: number,
  aggregation: MunicipalSpreadsheetAggregation,
): number | null {
  const count = entry.counts[position];
  if (count === 0) return null;
  return aggregation === "sum"
    ? entry.sums[position]
    : entry.sums[position] / count;
}

function countMissingByPeriod(
  rows: readonly MunicipalSpreadsheetRow[],
  periods: readonly string[],
): Record<string, number> {
  return Object.fromEntries(
    periods.map((periodKey, position) => [
      periodKey,
      rows.filter((row) => row.values[position] === null).length,
    ]),
  );
}

/**
 * Transforma as linhas municipais no instantâneo que a plataforma consome.
 *
 * Todos os recortes são calculados aqui, uma vez, e não a cada leitura: o
 * trabalho é o mesmo para Brasil e para um bioma, e guardá-lo pronto é o que
 * faz o painel responder sem reabrir a planilha.
 *
 * @example
 * aggregateMunicipalSpreadsheet(rows, ["2010", "2020"], "sum").snapshot.values.br;
 * // [12345, 23456]
 */
export function aggregateMunicipalSpreadsheet(
  rows: readonly MunicipalSpreadsheetRow[],
  periods: readonly string[],
  aggregation: MunicipalSpreadsheetAggregation,
  generatedAt: string = new Date().toISOString(),
): MunicipalSpreadsheetAggregationResult {
  const territories = new Map<string, TerritoryAccumulator>();
  const locations: Record<string, string> = {};
  const values: Record<string, (number | null)[]> = {};
  let unknownStateCount = 0;

  for (const row of rows) {
    locations[row.municipalityCode] = row.label;
    values[row.municipalityCode] = [...row.values];

    const stateCode = resolveGeeStateCode(row.stateCode, row.stateName);
    if (stateCode) {
      accumulate(
        territories,
        stateCode,
        getStateLabel(stateCode, row.stateName || row.stateCode),
        row.values,
      );
    } else {
      unknownStateCount += 1;
    }

    for (const [locationKey, label] of resolveAggregateKeys(row)) {
      accumulate(territories, locationKey, label, row.values);
    }
  }

  for (const [locationKey, entry] of territories) {
    locations[locationKey] = entry.label;
    values[locationKey] = periods.map((_periodKey, position) =>
      resolveValue(entry, position, aggregation),
    );
  }

  return {
    snapshot: {
      schemaVersion: 1,
      type: MUNICIPAL_SPREADSHEET_SNAPSHOT_TYPE,
      generatedAt,
      periods: [...periods],
      aggregation,
      locations,
      values,
    },
    missingByPeriod: countMissingByPeriod(rows, periods),
    unknownStateCount,
  };
}
