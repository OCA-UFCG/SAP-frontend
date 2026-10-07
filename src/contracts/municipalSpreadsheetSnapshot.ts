import type { MunicipalSpreadsheetAggregation } from "@/contracts/municipalSpreadsheet";

export const MUNICIPAL_SPREADSHEET_SNAPSHOT_TYPE =
  "municipal-spreadsheet-snapshot";

/**
 * Os valores de todos os territórios e períodos de uma planilha, já agregados.
 *
 * Os valores de cada território vêm como lista alinhada a `periods`, e não como
 * objeto por período: são mais de cinco mil municípios, e repetir a chave do ano
 * em cada um deles dobraria o tamanho do arquivo sem acrescentar informação.
 * `null` é ausência de dado — o município que não existia no ano, ou a célula
 * vazia da planilha — e é diferente de zero.
 *
 * @example
 * const snapshot: MunicipalSpreadsheetSnapshot = {
 *   schemaVersion: 1,
 *   type: "municipal-spreadsheet-snapshot",
 *   generatedAt: "2026-09-18T12:00:00.000Z",
 *   periods: ["2010", "2020"],
 *   aggregation: "sum",
 *   locations: { br: "Brasil", "2507507": "João Pessoa - PB" },
 *   values: { br: [1, 2], "2507507": [null, 2] },
 * };
 */
export interface MunicipalSpreadsheetSnapshot {
  schemaVersion: 1;
  type: typeof MUNICIPAL_SPREADSHEET_SNAPSHOT_TYPE;
  generatedAt: string;
  periods: string[];
  aggregation: MunicipalSpreadsheetAggregation;
  /** Chave territorial da plataforma (`br`, `pb`, `2507507`, `3_bioma-caatinga`) → rótulo. */
  locations: Record<string, string>;
  /** Chave territorial → um valor por período, na ordem de `periods`. */
  values: Record<string, (number | null)[]>;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

function assertValueLists(
  values: Record<string, unknown>,
  periodCount: number,
) {
  for (const [locationKey, list] of Object.entries(values)) {
    if (
      !Array.isArray(list) ||
      list.length !== periodCount ||
      list.some((item) => item !== null && !Number.isFinite(item))
    ) {
      throw new Error(
        `Instantâneo de planilha inválido: values.${locationKey} deve ter ${periodCount} número(s) ou null, recebido ${JSON.stringify(list)?.slice(0, 120)}.`,
      );
    }
  }
}

/**
 * Recusa um instantâneo malformado em vez de deixá-lo chegar ao painel.
 *
 * O arquivo vem de um asset do Contentful, que qualquer pessoa com acesso ao
 * espaço pode substituir — a mesma razão pela qual `validateImageDataContract`
 * existe para o `imageData`.
 */
export function parseMunicipalSpreadsheetSnapshot(
  value: unknown,
): MunicipalSpreadsheetSnapshot {
  if (!isRecord(value)) {
    throw new Error("Instantâneo de planilha inválido: esperado um objeto.");
  }
  if (
    value.schemaVersion !== 1 ||
    value.type !== MUNICIPAL_SPREADSHEET_SNAPSHOT_TYPE
  ) {
    throw new Error(
      `Instantâneo de planilha inválido: esperado schemaVersion 1 e type ${MUNICIPAL_SPREADSHEET_SNAPSHOT_TYPE}, recebido ${JSON.stringify(value.schemaVersion)}/${JSON.stringify(value.type)}.`,
    );
  }
  if (!isStringList(value.periods) || value.periods.length === 0) {
    throw new Error(
      `Instantâneo de planilha inválido: periods deve ser uma lista não vazia de textos, recebido ${JSON.stringify(value.periods)?.slice(0, 120)}.`,
    );
  }
  if (value.aggregation !== "sum" && value.aggregation !== "mean") {
    throw new Error(
      `Instantâneo de planilha inválido: aggregation deve ser sum ou mean, recebido ${JSON.stringify(value.aggregation)}.`,
    );
  }
  if (!isRecord(value.locations) || !isRecord(value.values)) {
    throw new Error(
      "Instantâneo de planilha inválido: locations e values devem ser objetos.",
    );
  }

  assertValueLists(value.values, value.periods.length);

  return {
    schemaVersion: 1,
    type: MUNICIPAL_SPREADSHEET_SNAPSHOT_TYPE,
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
    periods: value.periods,
    aggregation: value.aggregation,
    locations: value.locations as Record<string, string>,
    values: value.values as Record<string, (number | null)[]>,
  };
}
