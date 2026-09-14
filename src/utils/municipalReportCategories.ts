import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import { stableMunicipalReportAlias } from "@/utils/municipalReport";

export type ReportCategoryKey =
  | "climate"
  | "environmental"
  | "socioeconomic"
  | "others";

/**
 * A ordem das colunas do índice de variáveis. É a mesma ordem dos acordeões do
 * formulário, de propósito: quem marcou os checkboxes reconhece o documento.
 */
export const REPORT_CATEGORY_ORDER: readonly ReportCategoryKey[] = [
  "climate",
  "environmental",
  "socioeconomic",
  "others",
];

/**
 * Cor da pílula de período e da barra de acento das subseções, por categoria.
 *
 * São valores de apresentação, e não cores de classe: a cor de uma classe vem
 * sempre de `analysis.classes[].color`. Estas existem para o leitor associar
 * uma seção à coluna do índice de onde ele veio.
 *
 * Os valores vêm do frame `3605:9085` do Figma — as pílulas de `--a-200`,
 * `--ss-200` e `--d-200`, e os acentos das linhas de cada cabeçalho.
 */
export const REPORT_CATEGORY_TOKENS: Record<
  ReportCategoryKey,
  { pill: string; pillInk: string; accent: string }
> = {
  climate: { pill: "#C4EEF4", pillInk: "#292829", accent: "#76D6E4" },
  environmental: { pill: "#D3C5B5", pillInk: "#292829", accent: "#96755C" },
  socioeconomic: { pill: "#FECB89", pillInk: "#292829", accent: "#FC8F23" },
  others: { pill: "#C8CAC5", pillInk: "#292829", accent: "#C8CAC5" },
};

/**
 * As chaves usam a mesma normalização de `stableMunicipalReportAlias`, que já
 * remove acento, caixa e pontuação. Reusá-la evita uma segunda definição de "o
 * que é o mesmo rótulo" convivendo com a do resto do relatório.
 */
const CATEGORY_BY_NORMALIZED_LABEL: Record<string, ReportCategoryKey> = {
  dados_climaticos: "climate",
  dados_ambientais: "environmental",
  dados_socioeconomicos: "socioeconomic",
};

/**
 * A chave de categoria de um índice. Uma categoria desconhecida cai em
 * "others" em vez de virar uma coluna nova: o design tem três colunas.
 *
 * @example
 * resolveReportCategoryKey("Dados Climáticos"); // "climate"
 */
export function resolveReportCategoryKey(category?: string): ReportCategoryKey {
  if (!category?.trim()) return "others";

  return (
    CATEGORY_BY_NORMALIZED_LABEL[stableMunicipalReportAlias(category)] ??
    "others"
  );
}

/** Os tokens de cor da categoria de um índice, já resolvidos. */
export function getReportCategoryTokens(category?: string) {
  return REPORT_CATEGORY_TOKENS[resolveReportCategoryKey(category)];
}

export interface ReportCategoryGroup {
  key: ReportCategoryKey;
  analyses: MunicipalReportAnalysis[];
}

/**
 * As análises agrupadas nas colunas do índice, na ordem do design e sem
 * colunas vazias.
 *
 * A ordem dentro de cada grupo é a ordem em que as análises chegaram, que é a
 * ordem escolhida no formulário — a mesma em que as seções aparecem abaixo.
 *
 * @example
 * groupReportAnalysesByCategory(report.analyses);
 */
export function groupReportAnalysesByCategory(
  analyses: readonly MunicipalReportAnalysis[],
): ReportCategoryGroup[] {
  const grouped = new Map<ReportCategoryKey, MunicipalReportAnalysis[]>();

  for (const analysis of analyses) {
    const key = resolveReportCategoryKey(analysis.category);
    const current = grouped.get(key);
    if (current) current.push(analysis);
    else grouped.set(key, [analysis]);
  }

  return REPORT_CATEGORY_ORDER.flatMap((key) => {
    const items = grouped.get(key);
    return items?.length ? [{ key, analyses: items }] : [];
  });
}

/** O id da âncora da seção de um índice, usado pelo índice navegável. */
export function reportAnalysisAnchorId(alias: string) {
  return `report-analysis-${alias}`;
}

/**
 * O período como ele aparece na pílula do índice: `05/2026` para uma série
 * mensal, `2021` para uma anual.
 *
 * As duas formas convivem na mesma coluna — o Monitor de Secas é mensal e o
 * Índice de Aridez é decenal —, então a pílula precisa aceitar as duas em vez
 * de assumir que todo índice do relatório tem o mesmo período.
 *
 * @example
 * formatReportPeriodPill("2026-05"); // "05/2026"
 */
export function formatReportPeriodPill(period: string | null | undefined) {
  if (!period) return "—";
  const monthly = /^(\d{4})-(\d{2})$/u.exec(period);

  return monthly ? `${monthly[2]}/${monthly[1]}` : period;
}
