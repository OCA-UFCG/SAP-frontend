import {
  MUNICIPAL_SPREADSHEET_COLUMNS,
  REQUIRED_MUNICIPAL_SPREADSHEET_COLUMNS,
} from "@/contracts/municipalSpreadsheet";

/** Coluna de dado da convenção: qualquer nome terminado em `_{ano}`. */
const PERIOD_COLUMN_PATTERN = /^(.*)_(\d{4})$/u;

export interface SpreadsheetPeriodColumn {
  /** Chave de período da plataforma: o ano de quatro dígitos. */
  periodKey: string;
  /** Nome da coluna na planilha, como escrito no cabeçalho. */
  column: string;
}

/**
 * Uma linha municipal já lida da planilha, com os recortes territoriais a que
 * o município pertence.
 *
 * Os recortes vêm da própria planilha (`NM_REGIAO`, `BIOMA_PRED`, `SEMIÁRIDO`,
 * `ASD_ENTORN`) e não de um cruzamento espacial: é o que permite ao índice
 * responder bioma, região, ASD e semiárido sem tocar no Earth Engine.
 */
export interface MunicipalSpreadsheetRow {
  municipalityCode: string;
  label: string;
  stateCode: string;
  stateName: string;
  region: string;
  biome: string;
  isSemiarid: boolean;
  isAsdOrSurroundings: boolean;
  /** Um valor por período, na ordem das colunas descobertas. */
  values: (number | null)[];
}

/**
 * Compara nomes de coluna ignorando caixa, acento e espaços em volta, porque a
 * mesma convenção aparece como `SEMIÁRIDO` numa base e `SEMIARIDO` na seguinte.
 */
function normalizeColumnName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function buildColumnIndex(header: readonly unknown[]): Map<string, number> {
  const index = new Map<string, number>();
  header.forEach((name, position) => {
    const normalized = normalizeColumnName(name);
    if (normalized && !index.has(normalized)) index.set(normalized, position);
  });
  return index;
}

/**
 * Os prefixos de dado que a planilha oferece, para o formulário listar em vez
 * de pedir que o operador digite.
 *
 * @example
 * listSpreadsheetValuePrefixes(["CD_MUN", "pib_2010", "pib_2020"]); // ["pib"]
 */
export function listSpreadsheetValuePrefixes(
  header: readonly unknown[],
): string[] {
  const prefixes = header.flatMap((name) => {
    const match = String(name ?? "")
      .trim()
      .match(PERIOD_COLUMN_PATTERN);
    return match ? [match[1]] : [];
  });
  return [...new Set(prefixes)].sort();
}

/**
 * As colunas de um prefixo, em ordem de ano.
 *
 * @example
 * resolveSpreadsheetPeriodColumns(["pib_2020", "pib_2010"], "pib");
 * // [{ periodKey: "2010", column: "pib_2010" }, { periodKey: "2020", column: "pib_2020" }]
 */
export function resolveSpreadsheetPeriodColumns(
  header: readonly unknown[],
  valuePrefix: string,
): SpreadsheetPeriodColumn[] {
  const wanted = normalizeColumnName(valuePrefix);
  const columns = header.flatMap((name) => {
    const column = String(name ?? "").trim();
    const match = column.match(PERIOD_COLUMN_PATTERN);
    return match && normalizeColumnName(match[1]) === wanted
      ? [{ periodKey: match[2], column }]
      : [];
  });
  return columns.sort((left, right) =>
    left.periodKey.localeCompare(right.periodKey),
  );
}

export function assertSpreadsheetColumns(
  header: readonly unknown[],
  periodColumns: readonly SpreadsheetPeriodColumn[],
  valuePrefix: string,
) {
  const index = buildColumnIndex(header);
  const missing = REQUIRED_MUNICIPAL_SPREADSHEET_COLUMNS.filter(
    (column) => !index.has(normalizeColumnName(column)),
  );
  if (missing.length > 0) {
    throw new Error(
      `A planilha não tem as colunas obrigatórias ${missing.join(", ")}. As colunas encontradas foram: ${header.join(", ")}.`,
    );
  }
  if (periodColumns.length === 0) {
    const available = listSpreadsheetValuePrefixes(header);
    throw new Error(
      `A planilha não tem nenhuma coluna ${valuePrefix}_{ano}. Os dados disponíveis nela são: ${available.join(", ") || "nenhum"}.`,
    );
  }
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  // A planilha brasileira às vezes chega com vírgula decimal e separador de
  // milhar; um `Number("1.046.342,5")` viraria NaN e o município sairia sem dado.
  const parsed =
    typeof value === "number"
      ? value
      : Number(String(value).trim().replace(/\./gu, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function readCell(
  row: readonly unknown[],
  index: Map<string, number>,
  column: string,
): string {
  const position = index.get(normalizeColumnName(column));
  return position === undefined ? "" : String(row[position] ?? "").trim();
}

/** Código IBGE de 7 dígitos, aceito também quando a planilha o guarda como número. */
function readMunicipalityCode(
  row: readonly unknown[],
  index: Map<string, number>,
): string | null {
  const raw = readCell(
    row,
    index,
    MUNICIPAL_SPREADSHEET_COLUMNS.municipalityCode,
  );
  return /^\d{7}$/u.test(raw) ? raw : null;
}

function buildRow(
  row: readonly unknown[],
  index: Map<string, number>,
  periodColumns: readonly SpreadsheetPeriodColumn[],
  municipalityCode: string,
): MunicipalSpreadsheetRow {
  const name = readCell(
    row,
    index,
    MUNICIPAL_SPREADSHEET_COLUMNS.municipalityName,
  );
  const stateCode = readCell(
    row,
    index,
    MUNICIPAL_SPREADSHEET_COLUMNS.stateCode,
  ).toUpperCase();
  const asd = readCell(row, index, MUNICIPAL_SPREADSHEET_COLUMNS.asd);

  return {
    municipalityCode,
    label: stateCode ? `${name} - ${stateCode}` : name,
    stateCode,
    stateName: readCell(row, index, MUNICIPAL_SPREADSHEET_COLUMNS.stateName),
    region: readCell(row, index, MUNICIPAL_SPREADSHEET_COLUMNS.region),
    biome: readCell(row, index, MUNICIPAL_SPREADSHEET_COLUMNS.biome),
    isSemiarid: /^sim$/iu.test(
      readCell(row, index, MUNICIPAL_SPREADSHEET_COLUMNS.semiarid),
    ),
    // "ASD" e "Entorno" formam um recorte só na plataforma, e "Não" fica fora.
    isAsdOrSurroundings: asd !== "" && !/^n[ãa]o$/iu.test(asd),
    values: periodColumns.map(({ column }) =>
      toOptionalNumber(row[index.get(normalizeColumnName(column)) ?? -1]),
    ),
  };
}

export interface MunicipalSpreadsheetReading {
  rows: MunicipalSpreadsheetRow[];
  /** Linhas descartadas por não terem um código IBGE de 7 dígitos. */
  skippedRowCount: number;
}

/**
 * Lê as linhas municipais de uma planilha já baixada.
 *
 * Uma linha sem código IBGE é descartada em vez de derrubar a leitura: as bases
 * costumam trazer uma linha de rodapé com a fonte do dado, e recusar a planilha
 * inteira por causa dela obrigaria o operador a editar o arquivo original.
 *
 * @example
 * readMunicipalSpreadsheetRows(header, rows, [{ periodKey: "2020", column: "pib_2020" }]);
 */
export function readMunicipalSpreadsheetRows(
  header: readonly unknown[],
  rows: readonly (readonly unknown[])[],
  periodColumns: readonly SpreadsheetPeriodColumn[],
): MunicipalSpreadsheetReading {
  const index = buildColumnIndex(header);
  const read: MunicipalSpreadsheetRow[] = [];
  let skippedRowCount = 0;

  for (const row of rows) {
    const municipalityCode = readMunicipalityCode(row, index);
    if (!municipalityCode) {
      skippedRowCount += 1;
      continue;
    }
    read.push(buildRow(row, index, periodColumns, municipalityCode));
  }

  return { rows: read, skippedRowCount };
}
