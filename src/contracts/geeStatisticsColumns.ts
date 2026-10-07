/**
 * Como o catálogo explica que as colunas de um asset não servem para a forma de
 * tabela escolhida.
 *
 * Existe porque quem cadastra um índice não abre o Code Editor do Earth Engine:
 * a mensagem precisa dizer, de uma vez, tudo que está errado no mapeamento e
 * quais colunas o asset realmente tem. Vale para as duas formas de tabela, e é
 * por isso que mora nos contratos e não no serviço de uma delas.
 */

import {
  MONTH_PERIOD_PATTERN,
  YEAR_PERIOD_PATTERN,
} from "@/contracts/geeStatisticsAsset";

/**
 * Quantas colunas comuns a mensagem lista antes de resumir o resto. Vinte cobrem
 * o bloco territorial inteiro do IBGE (código, nome, UF, região e região
 * imediata, em sigla e por extenso), que é onde está a coluna que a pessoa
 * procura para corrigir o mapeamento; cortar antes escondia justamente `NM_UF` e
 * `SIGLA_UF`. O resto vira uma contagem para a mensagem não crescer sem limite.
 */
const MAX_LISTED_COLUMNS = 20;

/** Coluna interna do Earth Engine: ninguém a mapeia, e ela só ocuparia a lista. */
const INTERNAL_COLUMN = "system:index";

function isPeriodColumn(column: string) {
  return YEAR_PERIOD_PATTERN.test(column) || MONTH_PERIOD_PATTERN.test(column);
}

/**
 * As colunas de período separadas das demais.
 *
 * A separação é o que torna a mensagem legível numa tabela larga: o
 * `Municipios_S2ID_corrigido` tem 23 colunas de ano que empurrariam `CD_MUN` e
 * `NM_MUN` — justamente as que a pessoa procura — para fora da lista.
 *
 * @example
 * splitAssetColumns(["CD_MUN", "2024", "2025"]);
 * // { plain: ["CD_MUN"], periods: ["2024", "2025"] }
 */
export function splitAssetColumns(columnNames: readonly string[]) {
  const unique = [...new Set(columnNames)].filter(
    (column) => column !== INTERNAL_COLUMN,
  );
  return {
    plain: unique.filter((column) => !isPeriodColumn(column)).sort(),
    periods: unique.filter(isPeriodColumn).sort(),
  };
}

function formatPlainColumns(plain: string[]) {
  const remaining = plain.length - MAX_LISTED_COLUMNS;
  const listed = plain.slice(0, MAX_LISTED_COLUMNS).join(", ");
  return remaining > 0 ? `${listed} e mais ${remaining}` : listed;
}

function formatPeriodColumns(periods: string[]) {
  return periods.length === 1
    ? `a coluna de período ${periods[0]}`
    : `${periods.length} colunas de período (${periods[0]} a ${periods.at(-1)})`;
}

/**
 * As colunas que o asset tem, escritas para caber numa frase.
 *
 * @example
 * describeAssetColumns(["CD_MUN", "2024", "2025"]);
 * // "Colunas do asset: CD_MUN. Além delas, 2 colunas de período (2024 a 2025)."
 */
export function describeAssetColumns(columnNames: readonly string[]): string {
  const { plain, periods } = splitAssetColumns(columnNames);
  if (plain.length === 0 && periods.length === 0) {
    return "O asset não tem nenhuma coluna.";
  }
  if (plain.length === 0) {
    return `Colunas do asset: ${formatPeriodColumns(periods)}.`;
  }

  const listed = `Colunas do asset: ${formatPlainColumns(plain)}.`;
  return periods.length > 0
    ? `${listed} Além delas, ${formatPeriodColumns(periods)}.`
    : listed;
}

/**
 * A forma de tabela que as colunas sugerem, quando não é a que foi escolhida.
 *
 * Trocar "Forma da tabela" é a correção mais provável de um asset que não bate
 * com o mapeamento, e é a que a mensagem sozinha não deixaria óbvia: as duas
 * formas pedem colunas completamente diferentes.
 */
export function suggestStatisticsShape(
  chosen: "classes" | "value",
  columnNames: readonly string[],
): string | null {
  const { plain, periods } = splitAssetColumns(columnNames);
  if (chosen === "classes" && periods.length > 1) {
    return 'Cada período deste asset parece ser uma coluna: se o valor é um número só por município, escolha "Valor único por município (uma coluna por período)" na forma da tabela.';
  }
  if (
    chosen === "value" &&
    plain.some((column) => column.startsWith("perc_classe_"))
  ) {
    return 'Este asset tem colunas perc_classe_XX: se cada linha é um território num período, escolha "Distribuição por classes (perc_classe_XX)" na forma da tabela.';
  }
  return null;
}

export interface ColumnDiagnosisInput {
  assetId: string;
  /** Tudo que impede a leitura, e não só o primeiro problema encontrado. */
  problems: readonly string[];
  columnNames: readonly string[];
  shape: "classes" | "value";
}

/**
 * A mensagem completa de um asset cujas colunas não servem: o que está errado,
 * o que o asset tem e qual forma de tabela as colunas sugerem.
 *
 * @example
 * buildColumnDiagnosis({
 *   assetId: "projects/x/assets/municipios",
 *   problems: ["não possui colunas perc_classe_XX"],
 *   columnNames: ["CD_MUN", "2024", "2025"],
 *   shape: "classes",
 * });
 */
export function buildColumnDiagnosis({
  assetId,
  problems,
  columnNames,
  shape,
}: ColumnDiagnosisInput): string {
  return [
    `Asset estatístico ${assetId}: ${problems.join("; ")}.`,
    describeAssetColumns(columnNames),
    suggestStatisticsShape(shape, columnNames),
  ]
    .filter((part): part is string => Boolean(part))
    .join(" ");
}
