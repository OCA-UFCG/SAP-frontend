import type { AmfeSheetColumnAggregation } from "@/contracts/amfeSheetColumn";
import {
  buildStateRow,
  type MunicipalValueRow,
} from "@/repositories/platform/geeMunicipalValueTable";
import { resolveGeeStateCode } from "@/utils/geeStateCode";
import { MUNICIPALITY_KEY_PATTERN } from "@/utils/statisticsLocationScope";

/**
 * As colunas estruturais da aba de dados. São as mesmas que o backend da
 * análise multicritério exige (`REQUIRED_STRUCTURAL_COLUMNS`), e é por elas que
 * a planilha vira território da plataforma.
 */
export const AMFE_SHEET_MUNICIPALITY_CODE_COLUMN = "CD_MUN";
export const AMFE_SHEET_MUNICIPALITY_NAME_COLUMN = "NM_MUN";
export const AMFE_SHEET_STATE_COLUMN = "SIGLA_UF";

const STRUCTURAL_COLUMNS = new Set([
  AMFE_SHEET_MUNICIPALITY_CODE_COLUMN,
  AMFE_SHEET_MUNICIPALITY_NAME_COLUMN,
  AMFE_SHEET_STATE_COLUMN,
  "NM_RGI",
  "NM_RGINT",
  "NM_UF",
  "NM_REGIAO",
  "AREA_KM2",
  "BIOMA_PRED",
  "SEMIÁRIDO",
  "ASD_ENTORN",
]);

/** Um critério da aba `criterios`, que é o que o catálogo oferece como coluna. */
export interface AmfeSheetCriterion {
  column: string;
  label: string;
  unit: string;
  description: string;
}

export interface AmfeSheetMunicipality {
  code: string;
  name: string;
  stateCode: string;
  values: Record<string, number | null>;
}

export interface AmfeSheetTable {
  criteria: AmfeSheetCriterion[];
  municipalities: AmfeSheetMunicipality[];
}

function toOptionalFiniteNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readText(row: Record<string, unknown>, column: string): string {
  return String(row[column] ?? "").trim();
}

/**
 * Os critérios descritos na aba de metadados, restritos aos que existem mesmo
 * como coluna na aba de dados.
 *
 * Um critério listado sem coluna correspondente é ignorado em silêncio aqui: o
 * backend da análise multicritério é quem recusa a planilha inteira nesse caso,
 * e esta leitura não pode derrubar o catálogo por causa de uma linha de
 * metadado que ninguém usa.
 */
function readCriteria(
  metadataRows: readonly Record<string, unknown>[],
  columnNames: ReadonlySet<string>,
): AmfeSheetCriterion[] {
  return metadataRows.flatMap((row) => {
    const column = readText(row, "id");
    if (!column || !columnNames.has(column)) return [];

    return [
      {
        column,
        label: readText(row, "título") || column,
        unit: readText(row, "unit"),
        description: readText(row, "descrição"),
      },
    ];
  });
}

/**
 * A planilha da análise multicritério convertida no que a plataforma consome:
 * uma linha por município e a lista de critérios que podem virar índice.
 *
 * Linhas sem código IBGE válido são descartadas — a planilha traz uma linha de
 * total em algumas safras, e ela não é um território.
 *
 * @example
 * parseAmfeSheetTable(dataRows, metadataRows).criteria[0];
 * // { column: "ia_mean", label: "Índice de Aridez", unit: "", description: "…" }
 */
export function parseAmfeSheetTable(
  dataRows: readonly Record<string, unknown>[],
  metadataRows: readonly Record<string, unknown>[],
): AmfeSheetTable {
  const columnNames = new Set(dataRows.flatMap((row) => Object.keys(row)));
  const criteria = readCriteria(metadataRows, columnNames);
  const criteriaColumns = criteria.map((criterion) => criterion.column);

  const municipalities = dataRows.flatMap((row) => {
    const code = readText(row, AMFE_SHEET_MUNICIPALITY_CODE_COLUMN);
    if (!MUNICIPALITY_KEY_PATTERN.test(code)) return [];

    return [
      {
        code,
        name: readText(row, AMFE_SHEET_MUNICIPALITY_NAME_COLUMN),
        stateCode: readText(row, AMFE_SHEET_STATE_COLUMN),
        values: Object.fromEntries(
          criteriaColumns.map((column) => [
            column,
            toOptionalFiniteNumber(row[column]),
          ]),
        ),
      },
    ];
  });

  return { criteria, municipalities };
}

/** As colunas da aba de dados que não são estruturais nem critérios descritos. */
export function findUndescribedColumns(
  dataRows: readonly Record<string, unknown>[],
  criteria: readonly AmfeSheetCriterion[],
): string[] {
  const described = new Set(criteria.map((criterion) => criterion.column));
  return [...new Set(dataRows.flatMap((row) => Object.keys(row)))].filter(
    (column) => !STRUCTURAL_COLUMNS.has(column) && !described.has(column),
  );
}

function aggregate(
  values: readonly number[],
  aggregation: AmfeSheetColumnAggregation,
): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((sum, value) => sum + value, 0);
  return aggregation === "sum" ? total : total / values.length;
}

/**
 * As linhas territoriais de uma coluna: um município por linha, mais as UFs e o
 * Brasil agregados.
 *
 * O período é um só — a planilha não tem eixo de tempo —, então cada linha
 * carrega o valor sob a chave do ano escolhido no catálogo.
 *
 * @example
 * buildAmfeSheetValueRows(table, "ips", "2024", "mean");
 * // [{ locationKey: "br", … }, { locationKey: "pb", … }, { locationKey: "2507507", … }]
 */
export function buildAmfeSheetValueRows(
  table: AmfeSheetTable,
  column: string,
  periodKey: string,
  aggregation: AmfeSheetColumnAggregation,
): MunicipalValueRow[] {
  const municipalRows: MunicipalValueRow[] = [];
  const valuesByState = new Map<string, number[]>();
  const brazilValues: number[] = [];

  for (const municipality of table.municipalities) {
    const value = municipality.values[column] ?? null;
    municipalRows.push({
      locationKey: municipality.code,
      label: municipality.stateCode
        ? `${municipality.name} - ${municipality.stateCode.toUpperCase()}`
        : municipality.name,
      valuesByPeriod: { [periodKey]: value },
    });

    if (value === null) continue;
    brazilValues.push(value);
    const stateValues = valuesByState.get(municipality.stateCode) ?? [];
    stateValues.push(value);
    valuesByState.set(municipality.stateCode, stateValues);
  }

  const stateRows = [...valuesByState.entries()].flatMap(
    ([rawStateCode, values]) => {
      const row = buildStateRow(rawStateCode, {
        [periodKey]: aggregate(values, aggregation),
      });
      return row ? [row] : [];
    },
  );

  return [
    {
      locationKey: "br",
      label: "Brasil",
      valuesByPeriod: { [periodKey]: aggregate(brazilValues, aggregation) },
    },
    ...stateRows,
    ...municipalRows,
  ];
}

/** Os valores municipais de uma coluna, sem os vazios. */
export function collectColumnValues(
  table: AmfeSheetTable,
  column: string,
): number[] {
  return table.municipalities.flatMap((municipality) => {
    const value = municipality.values[column];
    return typeof value === "number" ? [value] : [];
  });
}

/** Quantas UFs a coluna tem valor, para a validação recusar uma coluna vazia. */
export function countStatesWithValue(
  table: AmfeSheetTable,
  column: string,
): number {
  const states = new Set<string>();
  for (const municipality of table.municipalities) {
    if (typeof municipality.values[column] !== "number") continue;
    const stateCode = resolveGeeStateCode(municipality.stateCode);
    if (stateCode) states.add(stateCode);
  }
  return states.size;
}
