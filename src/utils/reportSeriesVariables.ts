import type { MunicipalReportPeriodSnapshot } from "@/contracts/municipalReport";
import { formatReportPeriod } from "@/utils/municipalReportNarrative";
import {
  severityRank,
  type ReportSeveritySpec,
  type ReportVariableProfile,
} from "@/utils/reportVariableProfile";

/**
 * O valor de uma variável que a série daquele município não sustenta.
 *
 * Nunca `null`: a substituição do relatório devolve o próprio `[colchete]`
 * quando não encontra valor (`populateTemplate`), e um colchete impresso no
 * relatório do cidadão é pior do que a frase dizer "sem dados". A lista de
 * variáveis é a mesma para todos os municípios, então é aqui que se resolve o
 * município cuja série é mais curta que a do índice.
 */
export const REPORT_SERIES_NO_DATA = "sem dados";

/**
 * Abaixo de um décimo de ponto a frase diria "acréscimo" para uma diferença
 * que o relatório arredonda para zero na hora de imprimir.
 */
const VARIATION_DEAD_ZONE = 0.1;

const MONTHS_IN_YEAR = 12;

export type ReportSeriesVariableRequirement =
  "series" | "classes" | "value" | "monthly-year" | "severity" | "neutral";

export interface ReportSeriesVariable {
  /** Nome sem o escopo da camada: vira `<key>_<alias>` em `templateVariables`. */
  key: string;
  /** O que o operador escreve no texto do catálogo. */
  token: string;
  description: string;
  requires: readonly ReportSeriesVariableRequirement[];
}

function variable(
  key: string,
  description: string,
  requires: readonly ReportSeriesVariableRequirement[],
): ReportSeriesVariable {
  return { key, token: `[${key}]`, description, requires };
}

/**
 * Toda variável de série que o relatório sabe calcular, e o que cada uma exige
 * do índice para fazer sentido.
 *
 * Esta tabela é a fonte única: a tela do catálogo lista o que sai daqui, o
 * relatório calcula o que sai daqui e `LAYER_SCOPED_TEMPLATE_KEYS` é derivado
 * daqui. Manter as três listas à mão foi o que deixaria a tela prometer um
 * `[classe_anterior]` que o relatório não produz.
 */
export const REPORT_SERIES_VARIABLES: readonly ReportSeriesVariable[] = [
  variable(
    "quantidade_periodos",
    "Quantos períodos a série deste índice tem.",
    ["series"],
  ),
  variable("periodo_inicial", "Primeiro período da série, por extenso.", [
    "series",
  ]),
  variable("periodo_final", "Último período da série, por extenso.", [
    "series",
  ]),
  variable(
    "periodo_anterior",
    "O período imediatamente anterior ao analisado.",
    ["series"],
  ),
  variable("classe_anterior", "A classe predominante no período anterior.", [
    "series",
    "classes",
  ]),
  variable(
    "percentual_anterior",
    "Quanto da área estava nessa classe no período anterior.",
    ["series", "classes"],
  ),
  variable(
    "variacao_pontos",
    "Quantos pontos percentuais a classe atual subiu ou caiu desde o período anterior.",
    ["series", "classes"],
  ),
  variable(
    "acrescimo_decrescimo",
    "“acréscimo”, “decréscimo” ou “estabilidade”, conforme essa variação.",
    ["series", "classes"],
  ),
  variable(
    "classe_mais_frequente",
    "A classe que mais vezes predominou na série.",
    ["series", "classes"],
  ),
  variable(
    "percentual_freq",
    "Em quantos por cento dos períodos essa classe predominou.",
    ["series", "classes"],
  ),
  variable(
    "quantidade_periodos_na_classe",
    "Em quantos períodos a classe atual predominou.",
    ["series", "classes"],
  ),
  variable("valor_anterior", "O valor do indicador no período anterior.", [
    "series",
    "value",
  ]),
  variable(
    "diferenca_valor",
    "A diferença entre o valor atual e o do período anterior.",
    ["series", "value"],
  ),
  variable(
    "janela_12_meses",
    "Os 12 meses que terminam no período analisado, por extenso.",
    ["monthly-year"],
  ),
  variable(
    "classe_mesmo_mes_ano_anterior",
    "A classe predominante no mesmo mês do ano anterior.",
    ["monthly-year", "classes"],
  ),
  variable(
    "variacao_ano_a_ano",
    "Quantos pontos percentuais a classe atual mudou contra o mesmo mês do ano anterior.",
    ["monthly-year", "classes"],
  ),
  variable(
    "status_tendencia",
    "“agravando”, “amenizando” ou “mantendo”, comparando com o período anterior.",
    ["series", "severity"],
  ),
  variable(
    "classe_maior_severidade",
    "A classe mais grave já observada na série.",
    ["series", "severity"],
  ),
  variable(
    "periodo_maior_severidade",
    "Quando essa classe mais grave foi observada pela última vez.",
    ["series", "severity"],
  ),
  variable(
    "quantidade_periodos_com_fenomeno",
    "Em quantos períodos o município ficou fora da condição normal.",
    ["series", "neutral"],
  ),
  variable(
    "percentual_condicao_neutra",
    "Em quantos por cento dos períodos o município esteve na condição normal.",
    ["series", "neutral"],
  ),
];

export const REPORT_SERIES_VARIABLE_KEYS: readonly string[] =
  REPORT_SERIES_VARIABLES.map(({ key }) => key);

function satisfies(
  profile: ReportVariableProfile,
  requirement: ReportSeriesVariableRequirement,
): boolean {
  if (requirement === "series") return profile.periodCount >= 2;
  if (requirement === "classes") return profile.shape === "class-distribution";
  if (requirement === "value") return profile.shape === "municipal-value";
  if (requirement === "monthly-year") {
    return (
      profile.granularity === "month" && profile.periodCount > MONTHS_IN_YEAR
    );
  }
  if (requirement === "severity") {
    return Boolean(profile.severity) && profile.shape === "class-distribution";
  }
  return Boolean(profile.severity?.neutralClassId);
}

/**
 * As variáveis que fazem sentido para este índice — e só elas.
 *
 * Um índice anual não recebe a janela de 12 meses; um sem ordem de gravidade
 * declarada não recebe a tendência; um de previsão não recebe nenhuma, porque
 * os períodos dele são horizontes de uma mesma emissão e não história.
 *
 * @example
 * describeReportSeriesVariables({ granularity: "year", periodCount: 4, shape: "class-distribution", nature: "historical" })
 *   .map((entry) => entry.token); // ["[quantidade_periodos]", "[periodo_inicial]", ...]
 */
export function describeReportSeriesVariables(
  profile: ReportVariableProfile,
): ReportSeriesVariable[] {
  if (profile.nature === "forecast") return [];

  return REPORT_SERIES_VARIABLES.filter((entry) =>
    entry.requires.every((requirement) => satisfies(profile, requirement)),
  );
}

type SeriesValues = Record<string, string | number>;

function usableSeries(timeSeries: readonly MunicipalReportPeriodSnapshot[]) {
  return timeSeries
    .filter((snapshot) => snapshot.dominantClass)
    .sort((left, right) => left.period.localeCompare(right.period));
}

function percentageOf(
  snapshot: MunicipalReportPeriodSnapshot | undefined,
  classId: string,
) {
  return snapshot?.distribution.find((item) => item.id === classId)?.percentage;
}

function spanValues(
  series: MunicipalReportPeriodSnapshot[],
  locale: string,
): SeriesValues {
  const first = series[0];
  const last = series.at(-1);
  if (!first || !last) return {};

  return {
    quantidade_periodos: series.length,
    periodo_inicial: formatReportPeriod(first.period, locale),
    periodo_final: formatReportPeriod(last.period, locale),
  };
}

function previousPeriodValues(
  series: MunicipalReportPeriodSnapshot[],
  locale: string,
): SeriesValues {
  const last = series.at(-1);
  const previous = series.at(-2);
  if (!last?.dominantClass || !previous) return {};

  const currentClassId = last.dominantClass.id;
  const previousPercentage = percentageOf(previous, currentClassId) ?? 0;
  const variation = last.dominantClass.percentage - previousPercentage;

  return {
    periodo_anterior: formatReportPeriod(previous.period, locale),
    classe_anterior: previous.dominantClass?.label ?? REPORT_SERIES_NO_DATA,
    percentual_anterior: previous.dominantClass?.percentage ?? 0,
    variacao_pontos: Math.abs(variation),
    acrescimo_decrescimo: describeVariation(variation),
    valor_anterior: previous.dominantClass?.percentage ?? 0,
    diferenca_valor:
      last.dominantClass.percentage - (previous.dominantClass?.percentage ?? 0),
  };
}

function describeVariation(variation: number) {
  if (variation > VARIATION_DEAD_ZONE) return "acréscimo";
  if (variation < -VARIATION_DEAD_ZONE) return "decréscimo";
  return "estabilidade";
}

function frequencyValues(
  series: MunicipalReportPeriodSnapshot[],
): SeriesValues {
  const last = series.at(-1);
  if (!last?.dominantClass) return {};

  const counts = new Map<string, { count: number; label: string }>();
  for (const snapshot of series) {
    const { id, label } = snapshot.dominantClass!;
    const entry = counts.get(id) ?? { count: 0, label };
    counts.set(id, { count: entry.count + 1, label });
  }
  const [mostFrequent] = [...counts.values()].sort(
    (left, right) => right.count - left.count,
  );

  return {
    classe_mais_frequente: mostFrequent.label,
    percentual_freq: (mostFrequent.count / series.length) * 100,
    quantidade_periodos_na_classe:
      counts.get(last.dominantClass.id)?.count ?? 0,
  };
}

/** O período doze meses antes, na mesma forma `AAAA-MM` da série. */
function twelveMonthsBefore(period: string) {
  const match = /^(\d{4})-(\d{2})$/u.exec(period);
  if (!match) return null;
  return `${Number(match[1]) - 1}-${match[2]}`;
}

function yearOverYearValues(
  series: MunicipalReportPeriodSnapshot[],
  locale: string,
): SeriesValues {
  const last = series.at(-1);
  if (!last?.dominantClass) return {};

  const windowStart = series.at(-MONTHS_IN_YEAR);
  const sameMonthPeriod = twelveMonthsBefore(last.period);
  const sameMonth = series.find(
    (snapshot) => snapshot.period === sameMonthPeriod,
  );
  const values: SeriesValues = {};

  if (windowStart) {
    values.janela_12_meses = `${formatReportPeriod(windowStart.period, locale)} a ${formatReportPeriod(last.period, locale)}`;
  }
  if (sameMonth?.dominantClass) {
    values.classe_mesmo_mes_ano_anterior = sameMonth.dominantClass.label;
    values.variacao_ano_a_ano =
      last.dominantClass.percentage -
      (percentageOf(sameMonth, last.dominantClass.id) ?? 0);
  }
  return values;
}

function severityValues(
  series: MunicipalReportPeriodSnapshot[],
  severity: ReportSeveritySpec | undefined,
  locale: string,
): SeriesValues {
  const last = series.at(-1);
  if (!severity || !last?.dominantClass) return {};

  const worst = series.reduce((current, snapshot) =>
    severityRank(severity, snapshot.dominantClass!.id) >=
    severityRank(severity, current.dominantClass!.id)
      ? snapshot
      : current,
  );
  const neutralCount = severity.neutralClassId
    ? series.filter(
        (snapshot) => snapshot.dominantClass!.id === severity.neutralClassId,
      ).length
    : 0;

  return {
    status_tendencia: describeTrend(series, severity),
    classe_maior_severidade: worst.dominantClass!.label,
    periodo_maior_severidade: formatReportPeriod(worst.period, locale),
    quantidade_periodos_com_fenomeno: series.length - neutralCount,
    percentual_condicao_neutra: (neutralCount / series.length) * 100,
  };
}

function describeTrend(
  series: MunicipalReportPeriodSnapshot[],
  severity: ReportSeveritySpec,
) {
  const current = series.at(-1)!.dominantClass!.id;
  const previous = series.at(-2)?.dominantClass?.id;
  if (!previous) return "mantendo";

  const difference =
    severityRank(severity, current) - severityRank(severity, previous);
  if (difference > 0) return "agravando";
  if (difference < 0) return "amenizando";
  return "mantendo";
}

/**
 * Os valores das variáveis de série deste índice para um município.
 *
 * Devolve exatamente as chaves de `describeReportSeriesVariables` — nem mais,
 * para não oferecer na tela o que o relatório não produz, nem menos, para a
 * frase publicada nunca imprimir um colchete cru quando a série daquele
 * município é mais curta que a do índice.
 *
 * @example
 * computeReportSeriesVariables(timeSeries, profile).status_tendencia; // "agravando"
 */
export function computeReportSeriesVariables(
  timeSeries: readonly MunicipalReportPeriodSnapshot[],
  profile: ReportVariableProfile,
  locale = "pt-BR",
): SeriesValues {
  const offered = describeReportSeriesVariables(profile);
  if (offered.length === 0) return {};

  const series = usableSeries(timeSeries);
  const computed: SeriesValues = {
    ...spanValues(series, locale),
    ...previousPeriodValues(series, locale),
    ...frequencyValues(series),
    ...yearOverYearValues(series, locale),
    ...severityValues(series, profile.severity, locale),
  };

  return Object.fromEntries(
    offered.map(({ key }) => [key, computed[key] ?? REPORT_SERIES_NO_DATA]),
  );
}
