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

/**
 * Como a coluna escreve números: `decimal-comma` é o formato brasileiro
 * (`1.046.342,5`) e `decimal-point` o americano (`0.763`).
 */
export type SpreadsheetDecimalConvention = "decimal-point" | "decimal-comma";

/** Uma célula como "1.046", que tanto vale 1046 quanto 1,046. */
const AMBIGUOUS_CELL_PATTERN = /^-?\d{1,3}\.\d{3}$/u;

export interface SpreadsheetColumnConvention {
  convention: SpreadsheetDecimalConvention;
  /** Uma célula ambígua, quando nenhuma célula da coluna decidiu a convenção. */
  ambiguousSample: string | null;
}

function countSeparator(cell: string, separator: string) {
  return cell.split(separator).length - 1;
}

/**
 * O que uma célula sozinha consegue provar sobre a convenção da coluna.
 *
 * `null` quando ela não prova nada — é o caso de "1.046", que cabe nas duas
 * leituras e por isso precisa do resto da coluna para ser decidido.
 */
function decideConventionByCell(
  cell: string,
): SpreadsheetDecimalConvention | null {
  const lastDot = cell.lastIndexOf(".");
  const lastComma = cell.lastIndexOf(",");
  // Com os dois separadores na mesma célula, o último é o decimal.
  if (lastDot >= 0 && lastComma >= 0) {
    return lastDot > lastComma ? "decimal-point" : "decimal-comma";
  }
  // Repetido, um separador só pode ser o de milhar.
  if (countSeparator(cell, ".") > 1) return "decimal-comma";
  if (countSeparator(cell, ",") > 1) return "decimal-point";
  return null;
}

/**
 * Descobre, olhando a coluna inteira, o que o ponto separa nela.
 *
 * A decisão é da coluna e não da célula porque uma célula isolada não basta:
 * apagar todo ponto antes de converter — como se fazia aqui — lia o IDHM
 * "0.763" de uma coluna formatada como texto (o que acontece sempre que a base
 * veio de um CSV importado) como 763, em silêncio, para todo município.
 *
 * @example
 * inferColumnConvention(["1.046.342,5"]).convention; // "decimal-comma"
 * inferColumnConvention(["0.763"]).convention; // "decimal-point"
 */
export function inferColumnConvention(
  cells: readonly string[],
): SpreadsheetColumnConvention {
  for (const cell of cells) {
    const decided = decideConventionByCell(cell);
    if (decided) return { convention: decided, ambiguousSample: null };
  }

  // Nenhuma célula decidiu. A vírgula só aparece como decimal no formato
  // brasileiro, então ela ganha; sem vírgula nenhuma o ponto é decimal, que é
  // a leitura certa de "0.763" e a que o `Number` do JavaScript já faria.
  if (cells.some((cell) => cell.includes(","))) {
    return { convention: "decimal-comma", ambiguousSample: null };
  }
  return {
    convention: "decimal-point",
    ambiguousSample:
      cells.find((cell) => AMBIGUOUS_CELL_PATTERN.test(cell)) ?? null,
  };
}

function toOptionalNumber(
  value: unknown,
  convention: SpreadsheetDecimalConvention,
): number | null {
  // Uma célula numérica já chega pronta do xlsx: não há separador a interpretar.
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value ?? "").trim();
  if (!text) return null;

  const normalized =
    convention === "decimal-comma"
      ? text.replace(/\./gu, "").replace(",", ".")
      : text.replace(/,/gu, "");
  const parsed = Number(normalized);
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
  conventions: readonly SpreadsheetColumnConvention[],
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
    values: periodColumns.map(({ column }, position) =>
      toOptionalNumber(
        row[index.get(normalizeColumnName(column)) ?? -1],
        conventions[position].convention,
      ),
    ),
  };
}

/** Uma coluna cujo ponto tanto pode ser milhar quanto decimal. */
export interface AmbiguousDecimalColumn {
  column: string;
  sample: string;
}

export interface MunicipalSpreadsheetReading {
  rows: MunicipalSpreadsheetRow[];
  /** Linhas descartadas por não terem um código IBGE de 7 dígitos. */
  skippedRowCount: number;
  /** Colunas lidas como decimal sem que a coluna provasse a convenção. */
  ambiguousDecimalColumns: AmbiguousDecimalColumn[];
}

/**
 * As células de texto de uma coluna, que são as únicas que dizem algo sobre a
 * convenção: uma célula numérica já vem convertida do xlsx.
 */
function readColumnTextCells(
  rows: readonly (readonly unknown[])[],
  position: number | undefined,
): string[] {
  if (position === undefined) return [];
  return rows.flatMap((row) => {
    const cell = row[position];
    const text = typeof cell === "string" ? cell.trim() : "";
    return text ? [text] : [];
  });
}

function inferPeriodConventions(
  rows: readonly (readonly unknown[])[],
  index: Map<string, number>,
  periodColumns: readonly SpreadsheetPeriodColumn[],
): SpreadsheetColumnConvention[] {
  return periodColumns.map(({ column }) =>
    inferColumnConvention(
      readColumnTextCells(rows, index.get(normalizeColumnName(column))),
    ),
  );
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
  // Duas passadas: a convenção decimal é da coluna inteira, então ela precisa
  // estar decidida antes de converter a primeira célula. Só as linhas com
  // código IBGE entram na decisão — o rodapé com a fonte do dado não conta.
  const coded = rows.flatMap((row) => {
    const municipalityCode = readMunicipalityCode(row, index);
    return municipalityCode ? [{ row, municipalityCode }] : [];
  });
  const conventions = inferPeriodConventions(
    coded.map(({ row }) => row),
    index,
    periodColumns,
  );

  return {
    rows: coded.map(({ row, municipalityCode }) =>
      buildRow(row, index, periodColumns, conventions, municipalityCode),
    ),
    skippedRowCount: rows.length - coded.length,
    ambiguousDecimalColumns: conventions.flatMap(
      ({ ambiguousSample }, position) =>
        ambiguousSample
          ? [
              {
                column: periodColumns[position].column,
                sample: ambiguousSample,
              },
            ]
          : [],
    ),
  };
}
