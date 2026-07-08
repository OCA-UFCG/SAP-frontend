import type { MunicipalReportAnalysis, MunicipalReportData } from "@/contracts/municipalReport";
import type { MunicipalReportPresentationConfig } from "@/config/municipalReport";

export function formatReportPeriod(period: string, locale: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}

function formatClass(id: string, label: string, config: MunicipalReportPresentationConfig) {
  const code = config.history?.classes[id]?.code ?? config.classes?.[id]?.code;
  return code ? `${label} (${code})` : label;
}

function percentage(count: number, total: number, locale: string) {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 })
    .format(total ? count / total * 100 : 0);
}

export function buildSituationNarrative(
  analysis: MunicipalReportAnalysis,
  report: MunicipalReportData,
  config: MunicipalReportPresentationConfig,
  locale: string,
) {
  const dominant = analysis.snapshot?.dominantClass;
  if (!dominant || !analysis.effectivePeriod) return null;
  const place = `${report.municipality.name} — ${report.municipality.uf}`;
  return `No município de ${place}, predomina a classe ${formatClass(dominant.id, dominant.label, config)}, com ${dominant.percentage.toFixed(1)}% da área analisada ${config.coverageContext}, conforme os dados de ${analysis.title} para o período de ${formatReportPeriod(analysis.effectivePeriod, locale)}.`;
}

export function buildHistoryNarrative(
  analysis: MunicipalReportAnalysis,
  municipalityName: string,
  config: MunicipalReportPresentationConfig,
  locale: string,
) {
  const historyConfig = config.history;
  if (!historyConfig) return null;
  const referenceIndex = analysis.timeSeries.findIndex(({ period }) => period === analysis.effectivePeriod);
  if (referenceIndex < 0) return null;
  const history = analysis.timeSeries.slice(0, referenceIndex + 1).filter(({ dominantClass }) => dominantClass);
  const recent = history.slice(-12);
  const current = recent.at(-1);
  if (!current?.dominantClass) return null;
  const previous = recent.at(-2)?.dominantClass;
  const classRule = (id: string) => historyConfig.classes[id];
  const affected = recent.filter(({ dominantClass }) => dominantClass && !classRule(dominantClass.id)?.isNeutral).length;

  let comparison: string;
  const currentRule = classRule(current.dominantClass.id);
  const previousRule = previous && classRule(previous.id);
  if (!previous) {
    comparison = "Não há mês anterior disponível para comparação.";
  } else if (current.dominantClass.id === previous.id) {
    comparison = `A classificação permaneceu estável em relação ao mês anterior, quando também predominava ${formatClass(previous.id, previous.label, config)}.`;
  } else if (currentRule?.isNeutral) {
    comparison = `Houve melhora em relação ao mês anterior, quando predominava ${formatClass(previous.id, previous.label, config)}; no período atual não predomina condição de ${historyConfig.phenomenon}.`;
  } else if (previousRule?.isNeutral) {
    comparison = `Houve piora em relação ao mês anterior, quando predominava ${formatClass(previous.id, previous.label, config)}; no período atual passou a predominar ${formatClass(current.dominantClass.id, current.dominantClass.label, config)}.`;
  } else if (currentRule?.rank != null && previousRule?.rank != null) {
    const direction = currentRule.rank > previousRule.rank ? "agravamento" : "redução";
    comparison = `Houve ${direction} em relação ao mês anterior, quando predominava ${formatClass(previous.id, previous.label, config)}.`;
  } else {
    comparison = `No mês anterior predominava ${formatClass(previous.id, previous.label, config)}; as classes não possuem uma ordem configurada para qualificar essa mudança como melhora ou piora.`;
  }

  const frequencies = new Map<string, { count: number; label: string }>();
  for (const snapshot of history) {
    const dominant = snapshot.dominantClass!;
    const item = frequencies.get(dominant.id);
    frequencies.set(dominant.id, { count: (item?.count ?? 0) + 1, label: dominant.label });
  }
  const mostFrequent = [...frequencies.entries()].sort(([aId, a], [bId, b]) =>
    b.count - a.count || (classRule(bId)?.rank ?? -1) - (classRule(aId)?.rank ?? -1) || aId.localeCompare(bId))[0];
  const neutralCount = [...frequencies.entries()].reduce((sum, [id, item]) =>
    sum + (classRule(id)?.isNeutral ? item.count : 0), 0);
  const maximum = history.reduce((selected, snapshot) => {
    const rank = classRule(snapshot.dominantClass!.id)?.rank;
    const selectedRank = classRule(selected.dominantClass!.id)?.rank;
    return rank != null && (selectedRank == null || rank > selectedRank) ? snapshot : selected;
  });
  const maximumRule = classRule(maximum.dominantClass!.id);
  const maximumText = maximumRule?.rank != null
    ? `${formatClass(maximum.dominantClass!.id, maximum.dominantClass!.label, config)}, registrada em ${formatReportPeriod(maximum.period, locale)}`
    : "não pôde ser determinada porque as classes não possuem ordem configurada";

  return {
    recent: `A série histórica de ${analysis.title} registra que ${municipalityName} apresentou condição de ${historyConfig.phenomenon} em ${affected} dos últimos ${recent.length} períodos analisados (${formatReportPeriod(recent[0].period, locale)} a ${formatReportPeriod(current.period, locale)}). No período de referência (${formatReportPeriod(current.period, locale)}), predomina ${formatClass(current.dominantClass.id, current.dominantClass.label, config)}. ${comparison}`,
    context: `No período ${formatReportPeriod(history[0].period, locale)}–${formatReportPeriod(current.period, locale)}, a classe predominante mais frequente foi ${formatClass(mostFrequent[0], mostFrequent[1].label, config)}, em ${percentage(mostFrequent[1].count, history.length, locale)}% dos períodos. A condição ${historyConfig.neutralState} predominou em ${percentage(neutralCount, history.length, locale)}% do período. A maior ${historyConfig.severityTerm} observada foi ${maximumText}.`,
  };
}
