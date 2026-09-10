import type { PublishedPanelLayerReportSeverity } from "@/contracts/panelLayerReport";

export type ReportSeriesGranularity = "year" | "month";

/**
 * O que a série de um índice representa no tempo. Um índice de previsão tem
 * períodos no futuro — horizontes de uma mesma emissão —, e comparar dois
 * horizontes não é comparar história: nenhuma variável de série é oferecida
 * para ele.
 */
export type ReportSeriesNature = "historical" | "forecast";

/**
 * A forma do valor: distribuição por classes (`perc_classe_XX`) ou um número
 * por município. A segunda tem uma "classe" só, então falar em classe
 * predominante ou mais frequente não significa nada nela.
 */
export type ReportSeriesShape = "class-distribution" | "municipal-value";

export interface ReportSeveritySpec {
  /** Ids das classes, da condição melhor para a pior. */
  order: readonly string[];
  neutralClassId?: string;
}

export interface ReportVariableProfile {
  granularity: ReportSeriesGranularity;
  periodCount: number;
  shape: ReportSeriesShape;
  nature: ReportSeriesNature;
  severity?: ReportSeveritySpec;
}

export interface ReportVariableProfileInput {
  periods: readonly string[];
  classCount: number;
  severity?: ReportSeveritySpec | null;
  /** Relógio injetado: é ele que separa horizonte de previsão de histórico. */
  now?: Date;
}

const MONTHLY_PERIOD_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/u;

/** A chave do período em que hoje cai, na mesma forma da série do índice. */
function currentPeriodKey(now: Date, granularity: ReportSeriesGranularity) {
  const year = now.getUTCFullYear();
  if (granularity === "year") return String(year);
  return `${year}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * A granularidade sai da forma dos próprios períodos, e não de
 * `statisticsSource.periodGranularity`, porque assim vale igual para um índice
 * do catálogo e para um legado, que não publica fonte estatística nenhuma.
 */
function resolveGranularity(
  periods: readonly string[],
): ReportSeriesGranularity {
  return periods.some((period) => MONTHLY_PERIOD_PATTERN.test(period))
    ? "month"
    : "year";
}

/**
 * O perfil temporal de um índice: o que dá para dizer sobre a série dele sem
 * olhar os dados de nenhum município.
 *
 * A separação importa. A disponibilidade de uma variável tem que ser a mesma
 * para todos os municípios — senão um texto escrito com a lista calculada para
 * Campina Grande quebraria em outro município. Os valores de um município
 * entram só depois, em `computeReportSeriesVariables`.
 *
 * @example
 * describeReportVariableProfile({ periods: ["2024-08", "2024-09"], classCount: 6 });
 * // { granularity: "month", periodCount: 2, shape: "class-distribution", nature: "historical" }
 */
export function describeReportVariableProfile({
  periods,
  classCount,
  severity,
  now = new Date(),
}: ReportVariableProfileInput): ReportVariableProfile {
  const sorted = [...periods].sort((left, right) => left.localeCompare(right));
  const granularity = resolveGranularity(sorted);
  const last = sorted.at(-1);

  return {
    granularity,
    periodCount: sorted.length,
    shape: classCount <= 1 ? "municipal-value" : "class-distribution",
    nature:
      last && last > currentPeriodKey(now, granularity)
        ? "forecast"
        : "historical",
    ...(severity && severity.order.length >= 2 ? { severity } : {}),
  };
}

/**
 * A ordem de gravidade que o relatório deve usar para um índice.
 *
 * O catálogo é a fonte preferida porque é onde quem cadastra declara a ordem.
 * Os `rank`/`isNeutral` estáticos existem desde antes do catálogo, em
 * `MUNICIPAL_REPORT_LAYERS`, e continuam valendo para o Monitor de Secas e a
 * Degradação — é o que faz esses dois passarem pelo mesmo cálculo genérico em
 * vez de manterem uma implementação própria.
 */
export function resolveReportSeverity(
  published: PublishedPanelLayerReportSeverity | null | undefined,
  fallbackRanks?: Record<string, { rank?: number; isNeutral?: boolean }>,
): ReportSeveritySpec | undefined {
  if (published && published.order.length >= 2) {
    return {
      order: published.order,
      ...(published.neutralClassId
        ? { neutralClassId: published.neutralClassId }
        : {}),
    };
  }
  if (!fallbackRanks) return undefined;

  const ranked = Object.entries(fallbackRanks).filter(
    ([, entry]) => typeof entry.rank === "number",
  );
  if (ranked.length < 2) return undefined;

  const order = ranked
    .sort(([, left], [, right]) => left.rank! - right.rank!)
    .map(([id]) => id);
  const neutralClassId = ranked.find(([, entry]) => entry.isNeutral)?.[0];

  return { order, ...(neutralClassId ? { neutralClassId } : {}) };
}

/** Onde a classe está na escala de gravidade; `-1` quando não foi declarada. */
export function severityRank(
  severity: ReportSeveritySpec | undefined,
  classId: string,
): number {
  return severity ? severity.order.indexOf(classId) : -1;
}
