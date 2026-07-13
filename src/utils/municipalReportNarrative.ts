import {
  MUNICIPAL_REPORT_DOCS_REPORT_KEY,
  type MunicipalReportAnalysis,
  type MunicipalReportData,
  type MunicipalReportDocsContent,
} from "@/contracts/municipalReport";
import { type MunicipalReportPresentationConfig } from "@/config/municipalReport";

export function formatReportPeriod(period: string, locale: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) return period;
  return new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}

function normalizeSectionTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function sectionTitleMatches(sectionTitle: string, expectedTitles: Set<string>) {
  const normalizedTitle = normalizeSectionTitle(sectionTitle);

  return [...expectedTitles].some((expectedTitle) =>
    normalizedTitle === expectedTitle ||
    normalizedTitle.endsWith(` ${expectedTitle}`) ||
    normalizedTitle.includes(expectedTitle),
  );
}

export function getReportDocsText(
  docsContent: MunicipalReportDocsContent | null,
  sectionTitle: string,
) {
  const sections = docsContent?.[MUNICIPAL_REPORT_DOCS_REPORT_KEY];
  if (!sections) return null;

  const expectedTitles = new Set([normalizeSectionTitle(sectionTitle)]);
  return sections.find((section) =>
    sectionTitleMatches(section.title, expectedTitles),
  )?.text.trim() || null;
}

function findGeneratedSectionText(
  analysis: MunicipalReportAnalysis,
  docsContent: MunicipalReportDocsContent | null,
  sectionTitles: string[],
) {
  const theme = analysis.id;
  if (!theme || !docsContent?.[theme]) return null;

  const normalizedTitles = new Set(sectionTitles.map(normalizeSectionTitle));
  return docsContent[theme].find((section) =>
    sectionTitleMatches(section.title, normalizedTitles),
  )?.text.trim() || null;
}

export function buildAnalysisNarrativeSections(
  analysis: MunicipalReportAnalysis,
  docsContent: MunicipalReportDocsContent | null,
) {
  const theme = analysis.id;
  if (!theme || !docsContent?.[theme]) return [];

  const situationTitles = new Set(["situacao atual"]);
  let skippedPrimarySituation = false;

  return docsContent[theme].filter((section) => {
    if (!section.text.trim()) return false;
    if (!skippedPrimarySituation && sectionTitleMatches(section.title, situationTitles)) {
      skippedPrimarySituation = true;
      return false;
    }
    return true;
  });
}

export function buildSituationNarrative(
  analysis: MunicipalReportAnalysis,
  docsContent: MunicipalReportDocsContent | null,
  report?: MunicipalReportData,
  config?: MunicipalReportPresentationConfig,
  locale?: string,
) {
  const docsText = findGeneratedSectionText(analysis, docsContent, [
    "Situação atual",
    "Situacao atual",
  ]);
  if (docsText) return docsText;
  if (!report || !config || !locale) return null;

  const dominant = analysis.snapshot?.dominantClass;
  if (!dominant || !analysis.effectivePeriod) return null;
  const place = `${report.municipality.name} — ${report.municipality.uf}`;
  const code = config.history?.classes[dominant.id]?.code ?? config.classes?.[dominant.id]?.code;
  const className = code ? `${dominant.label} (${code})` : dominant.label;
  return `No município de ${place}, predomina a classe ${className}, com ${dominant.percentage.toFixed(1)}% da área analisada ${config.coverageContext}, conforme os dados de ${analysis.title} para o período de ${formatReportPeriod(analysis.effectivePeriod, locale)}.`;
}

export function buildHistoryNarrative(
  analysis: MunicipalReportAnalysis,
  docsContent: MunicipalReportDocsContent | null,
  municipalityName?: string,
  config?: MunicipalReportPresentationConfig,
  locale?: string,
) {
  const recent = findGeneratedSectionText(analysis, docsContent, [
    "Tendência recente",
    "Tendencia recente",
  ]);
  const context = findGeneratedSectionText(analysis, docsContent, [
    "Contexto histórico",
    "Contexto historico",
  ]);

  if (recent || context) return { recent, context };
  if (!municipalityName || !config?.history || !locale) return null;

  const referenceIndex = analysis.timeSeries.findIndex(({ period }) => period === analysis.effectivePeriod);
  if (referenceIndex < 0) return null;
  const history = analysis.timeSeries.slice(0, referenceIndex + 1).filter(({ dominantClass }) => dominantClass);
  const current = history.at(-1);
  if (!current?.dominantClass) return null;
  const recentHistory = history.slice(-12);
  const classRule = (id: string) => config.history!.classes[id];
  const formatClass = (id: string, label: string) => {
    const code = classRule(id)?.code ?? config.classes?.[id]?.code;
    return code ? `${label} (${code})` : label;
  };
  const affected = recentHistory.filter(({ dominantClass }) => dominantClass && !classRule(dominantClass.id)?.isNeutral).length;
  const previous = recentHistory.at(-2)?.dominantClass;
  let comparison = "Não há mês anterior disponível para comparação.";
  if (previous && current.dominantClass.id === previous.id) {
    comparison = `A classificação permaneceu estável em relação ao mês anterior, quando também predominava ${formatClass(previous.id, previous.label)}.`;
  } else if (previous && classRule(current.dominantClass.id)?.isNeutral) {
    comparison = `Houve melhora em relação ao mês anterior, quando predominava ${formatClass(previous.id, previous.label)}; no período atual não predomina condição de ${config.history.phenomenon}.`;
  } else if (previous && classRule(previous.id)?.isNeutral) {
    comparison = `Houve piora em relação ao mês anterior, quando predominava ${formatClass(previous.id, previous.label)}; no período atual passou a predominar ${formatClass(current.dominantClass.id, current.dominantClass.label)}.`;
  } else if (previous && classRule(current.dominantClass.id)?.rank != null && classRule(previous.id)?.rank != null) {
    comparison = `Houve ${classRule(current.dominantClass.id)!.rank! > classRule(previous.id)!.rank! ? "agravamento" : "redução"} em relação ao mês anterior, quando predominava ${formatClass(previous.id, previous.label)}.`;
  }

  const frequencies = new Map<string, { count: number; label: string }>();
  for (const snapshot of history) {
    const dominant = snapshot.dominantClass!;
    const item = frequencies.get(dominant.id);
    frequencies.set(dominant.id, { count: (item?.count ?? 0) + 1, label: dominant.label });
  }
  const entries = [...frequencies.entries()];
  const mostFrequent = entries.sort(([aId, a], [bId, b]) => b.count - a.count || (classRule(bId)?.rank ?? -1) - (classRule(aId)?.rank ?? -1))[0];
  const neutralCount = entries.reduce((sum, [id, item]) => sum + (classRule(id)?.isNeutral ? item.count : 0), 0);
  const maximum = history.reduce((selected, snapshot) => (classRule(snapshot.dominantClass!.id)?.rank ?? -1) > (classRule(selected.dominantClass!.id)?.rank ?? -1) ? snapshot : selected);
  const maximumText = `${formatClass(maximum.dominantClass!.id, maximum.dominantClass!.label)}, registrada em ${formatReportPeriod(maximum.period, locale)}`;
  const percentage = (count: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format((count / history.length) * 100);

  return {
    recent: `A série histórica de ${analysis.title} registra que ${municipalityName} apresentou condição de ${config.history.phenomenon} em ${affected} dos últimos ${recentHistory.length} períodos analisados (${formatReportPeriod(recentHistory[0].period, locale)} a ${formatReportPeriod(current.period, locale)}). No período de referência (${formatReportPeriod(current.period, locale)}), predomina ${formatClass(current.dominantClass.id, current.dominantClass.label)}. ${comparison}`,
    context: `No período ${formatReportPeriod(history[0].period, locale)}–${formatReportPeriod(current.period, locale)}, a classe predominante mais frequente foi ${formatClass(mostFrequent[0], mostFrequent[1].label)}, em ${percentage(mostFrequent[1].count)}% dos períodos. A condição ${config.history.neutralState} predominou em ${percentage(neutralCount)}% do período. A maior ${config.history.severityTerm} observada foi ${maximumText}.`,
  };
}
