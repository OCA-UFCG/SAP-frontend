import {
  MONTH_PERIOD_PATTERN,
  PERIOD_PLACEHOLDER_PATTERN,
  YEAR_PERIOD_PATTERN,
  type GeeStatisticsPeriodGranularity,
} from "@/contracts/geeStatisticsAsset";

interface PeriodParts {
  year?: string;
  month?: string;
  period?: string;
}

const PLACEHOLDER_GROUPS: Array<[string, string]> = [
  ["\\{year\\}", "(?<year>\\d{4})"],
  ["\\{month\\}", "(?<month>0[1-9]|1[0-2])"],
  ["\\{period\\}", "(?<period>\\d{4}(?:-(?:0[1-9]|1[0-2]))?)"],
];

/**
 * O padrão que reconhece um valor produzido por um template de período.
 *
 * Serve tanto para o endereço de um asset (`estat_{year}`) quanto para o nome de
 * uma coluna de tabela larga (`{year}`), porque os dois usam os mesmos
 * placeholders.
 */
export function buildPeriodTemplatePattern(template: string): RegExp {
  const escaped = template.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `^${PLACEHOLDER_GROUPS.reduce(
      (pattern, [placeholder, group]) => pattern.replaceAll(placeholder, group),
      escaped,
    )}$`,
    "u",
  );
}

function matchPeriodTemplate(
  template: string,
  value: string,
): PeriodParts | null {
  if (!PERIOD_PLACEHOLDER_PATTERN.test(template)) return {};
  return buildPeriodTemplatePattern(template).exec(value)?.groups ?? null;
}

/**
 * Junta o que o endereço do asset sabe com o que o nome da coluna sabe.
 *
 * Uma tabela por ano cujas colunas são meses (`estat_{year}` + `{month}`) só
 * identifica o período com as duas metades, e é por isso que a combinação
 * existe em vez de cada template resolver sozinho.
 */
function combinePeriodParts(...parts: PeriodParts[]): string | null {
  const merged = Object.assign({}, ...parts) as PeriodParts;
  if (merged.period) return merged.period;
  if (merged.year && merged.month) return `${merged.year}-${merged.month}`;
  return merged.year ?? null;
}

export interface ValueTablePeriodColumn {
  periodKey: string;
  column: string;
}

/**
 * Os períodos que uma tabela cobre e a coluna de cada um.
 *
 * Quando a coluna do valor tem placeholder, cada período é uma coluna da tabela
 * larga — a forma dos dados socioeconômicos, em que `2004`…`2025` são colunas do
 * mesmo asset. Quando não tem, o asset inteiro é um período só e o nome dele
 * carrega a data.
 *
 * @example
 * resolveValueTablePeriodColumns(
 *   { assetIdTemplate: undefined, assetId: "projects/x/assets/pob_total" },
 *   "{year}", "year", ["2024", "2025", "CD_MUN"],
 * ); // [{ periodKey: "2024", column: "2024" }, { periodKey: "2025", column: "2025" }]
 */
export function resolveValueTablePeriodColumns(
  asset: { assetId: string; assetIdTemplate?: string },
  valueProperty: string,
  periodGranularity: GeeStatisticsPeriodGranularity,
  columnNames: readonly string[],
): ValueTablePeriodColumn[] {
  const assetParts = asset.assetIdTemplate
    ? matchPeriodTemplate(asset.assetIdTemplate, asset.assetId)
    : {};
  if (!assetParts) {
    throw new Error(
      `O endereço ${asset.assetId} não corresponde ao template ${asset.assetIdTemplate}.`,
    );
  }

  const isPeriodPattern =
    periodGranularity === "month" ? MONTH_PERIOD_PATTERN : YEAR_PERIOD_PATTERN;

  if (!PERIOD_PLACEHOLDER_PATTERN.test(valueProperty)) {
    const periodKey = combinePeriodParts(assetParts);
    return periodKey && isPeriodPattern.test(periodKey)
      ? [{ periodKey, column: valueProperty }]
      : [];
  }

  const columns = new Map<string, string>();
  for (const column of columnNames) {
    const columnParts = matchPeriodTemplate(valueProperty, column);
    if (!columnParts) continue;

    const periodKey = combinePeriodParts(assetParts, columnParts);
    if (!periodKey || !isPeriodPattern.test(periodKey)) continue;

    const existing = columns.get(periodKey);
    if (existing && existing !== column) {
      throw new Error(
        `As colunas ${existing} e ${column} de ${asset.assetId} descrevem o mesmo período ${periodKey}.`,
      );
    }
    columns.set(periodKey, column);
  }

  return [...columns.entries()]
    .map(([periodKey, column]) => ({ periodKey, column }))
    .sort((left, right) => left.periodKey.localeCompare(right.periodKey));
}
