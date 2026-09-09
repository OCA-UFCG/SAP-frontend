import type { GeeMunicipalValueTableStatisticsSource } from "@/contracts/geeMunicipalValueTable";
import { getStateLabel, resolveGeeStateCode } from "@/utils/geeStateCode";
import {
  MUNICIPALITY_KEY_PATTERN,
  shouldIncludeLocation,
} from "@/utils/statisticsLocationScope";
import type { CompactTerritorialAnalysisDatasetPatch } from "@/utils/municipalAnalysisMerge";

/**
 * Uma linha já territorializada da tabela municipal: a chave da plataforma, o
 * rótulo exibido e um valor por período.
 *
 * O Earth Engine devolve o município cru e os estados/Brasil já agregados, mas
 * as três formas viram a mesma linha antes de virar patch — é o que mantém a
 * conversão testável sem rede.
 */
export interface MunicipalValueRow {
  locationKey: string;
  label: string;
  valuesByPeriod: Record<string, number | null>;
}

function toOptionalFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * A linha de um município lida direto da tabela.
 *
 * @example
 * buildMunicipalityRow(source, { CD_MUN: "2507507", NM_MUN: "João Pessoa", SIGLA_UF: "PB" }, { "2024": 12 });
 * // { locationKey: "2507507", label: "João Pessoa - PB", valuesByPeriod: { "2024": 12 } }
 */
export function buildMunicipalityRow(
  source: GeeMunicipalValueTableStatisticsSource,
  properties: Record<string, unknown>,
  valuesByPeriod: Record<string, number | null>,
): MunicipalValueRow {
  const municipalityCode = String(
    properties[source.properties.municipalityCode] ?? "",
  ).trim();

  if (!MUNICIPALITY_KEY_PATTERN.test(municipalityCode)) {
    throw new Error(
      `Linha municipal sem código IBGE válido em ${source.properties.municipalityCode}: ${municipalityCode || "(vazio)"}.`,
    );
  }

  const locationName = String(
    properties[source.properties.locationName] ?? "",
  ).trim();
  const stateCode = resolveGeeStateCode(
    properties[source.properties.stateCode],
  )?.toUpperCase();

  return {
    locationKey: municipalityCode,
    label: stateCode ? `${locationName} - ${stateCode}` : locationName,
    valuesByPeriod,
  };
}

/**
 * A linha de uma UF a partir do grupo agregado pelo Earth Engine.
 *
 * Devolve `null` quando o grupo não corresponde a nenhuma UF conhecida: uma
 * tabela com lixo na coluna de UF não pode derrubar o ranking nacional inteiro.
 */
export function buildStateRow(
  rawStateCode: unknown,
  valuesByPeriod: Record<string, number | null>,
): MunicipalValueRow | null {
  const stateCode = resolveGeeStateCode(rawStateCode);
  if (!stateCode) return null;

  return {
    locationKey: stateCode,
    label: getStateLabel(stateCode, String(rawStateCode ?? "")),
    valuesByPeriod,
  };
}

/**
 * Os valores de um período, na ordem em que o Earth Engine devolveu as colunas.
 */
export function toValuesByPeriod(
  periodKeys: readonly string[],
  values: unknown,
): Record<string, number | null> {
  const list = Array.isArray(values) ? values : [];
  return Object.fromEntries(
    periodKeys.map((periodKey, position) => [
      periodKey,
      toOptionalFiniteNumber(list[position]),
    ]),
  );
}

export function toSingleValuesByPeriod(
  periodKeys: readonly string[],
  properties: Record<string, unknown>,
  columnByPeriod: Record<string, string>,
): Record<string, number | null> {
  return Object.fromEntries(
    periodKeys.map((periodKey) => [
      periodKey,
      toOptionalFiniteNumber(properties[columnByPeriod[periodKey]]),
    ]),
  );
}

/**
 * O patch `territorial-compact` de um período a partir das linhas já lidas.
 *
 * A camada tem uma classe só — o próprio indicador —, então cada território
 * entra como um vetor de um valor. Um período sem valor não vira entrada: o
 * painel trata a ausência como "sem dado", que é o certo para um município que
 * não existia no ano ou não foi medido.
 *
 * @example
 * mapMunicipalValueRows(rows, "2024", "br");
 */
export function mapMunicipalValueRows(
  rows: readonly MunicipalValueRow[],
  yearKey: string,
  requestedLocationKey: string,
): CompactTerritorialAnalysisDatasetPatch {
  const locations: Record<string, string> = {};
  const values: Record<string, number[]> = {};

  for (const row of rows) {
    if (!shouldIncludeLocation(requestedLocationKey, row.locationKey)) {
      continue;
    }

    locations[row.locationKey] = row.label;
    const value = row.valuesByPeriod[yearKey];
    if (value !== null && value !== undefined) {
      values[row.locationKey] = [value];
    }
  }

  return {
    locations,
    years: { [yearKey]: { valuesScale: 1, values } },
  };
}
