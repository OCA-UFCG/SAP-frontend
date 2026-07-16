import {
  MUNICIPAL_REPORT_DOCS_REPORT_KEY,
  type MunicipalReportAnalysis,
  type MunicipalReportData,
  type MunicipalReportDocsContent,
} from "@/contracts/municipalReport";
import { type MunicipalReportPresentationConfig } from "@/config/municipalReport";
import { formatMunicipalReportValueWithUnit } from "@/utils/municipalReportValue";

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

  const situationTitles = new Set([
    "situacao atual",
    "situacion actual",
    "current situation",
  ]);
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
  t?: (key: string, values?: Record<string, string>) => string,
  translateClass?: (label: string) => string,
  translateTitle?: (title: string, id: string) => string,
  tHas?: (key: string) => boolean,
) {
  const docsText = findGeneratedSectionText(analysis, docsContent, [
    "Situação atual",
    "Situacao atual",
    "Situación actual",
    "Situacion actual",
    "Current situation",
  ]);
  if (docsText) return docsText;
  if (!report || !config || !locale) return null;

  const dominant = analysis.snapshot?.dominantClass;
  if (!dominant || !analysis.effectivePeriod) return null;
  const place = `${report.municipality.name} — ${report.municipality.uf}`;
  const translatedLabel = translateClass ? translateClass(dominant.label) : dominant.label;
  const translatedTitle = translateTitle ? translateTitle(analysis.title, analysis.id) : analysis.title;
  const code = config.history?.classes[dominant.id]?.code ?? config.classes?.[dominant.id]?.code;
  const className = code ? `${translatedLabel} (${code})` : translatedLabel;
  if (analysis.valueType === "absolute") {
    const value = formatMunicipalReportValueWithUnit(
      dominant.percentage,
      analysis,
      locale,
    );
    if (t) {
      return t("narrative.absoluteFallback", {
        place,
        className,
        value,
        title: translatedTitle,
        period: formatReportPeriod(analysis.effectivePeriod, locale),
      });
    }
    return `No município de ${place}, o valor de ${className} é ${value}, conforme os dados de ${translatedTitle} para o período de ${formatReportPeriod(analysis.effectivePeriod, locale)}.`;
  }

  let coverageContext = config.coverageContext;
  if (t) {
    const slug = config.coverageContext
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");
    if (tHas) {
      if (tHas(`coverageContexts.${analysis.id}`)) {
        try {
          const byId = t(`coverageContexts.${analysis.id}`);
          if (byId && !byId.startsWith("coverageContexts.")) {
            coverageContext = byId;
          }
        } catch {
          // fallback
        }
      } else if (tHas(`coverageContexts.${slug}`)) {
        try {
          const bySlug = t(`coverageContexts.${slug}`);
          if (bySlug && !bySlug.startsWith("coverageContexts.")) {
            coverageContext = bySlug;
          }
        } catch {
          // fallback
        }
      }
    } else {
      try {
        const byId = t(`coverageContexts.${analysis.id}`);
        if (byId && !byId.startsWith("coverageContexts.")) {
          coverageContext = byId;
        } else {
          const bySlug = t(`coverageContexts.${slug}`);
          if (bySlug && !bySlug.startsWith("coverageContexts.")) {
            coverageContext = bySlug;
          }
        }
      } catch {
        // fallback to original config.coverageContext
      }
    }
  }

  if (t) {
    return t("narrative.percentageFallback", {
      place,
      className,
      percentage: dominant.percentage.toFixed(1),
      coverageContext,
      title: translatedTitle,
      period: formatReportPeriod(analysis.effectivePeriod, locale),
    });
  }
  return `No município de ${place}, predomina a classe ${className}, com ${dominant.percentage.toFixed(1)}% da área analisada ${coverageContext}, conforme os dados de ${translatedTitle} para o período de ${formatReportPeriod(analysis.effectivePeriod, locale)}.`;
}

export function buildHistoryNarrative(
  analysis: MunicipalReportAnalysis,
  docsContent: MunicipalReportDocsContent | null,
  municipalityName?: string,
  config?: MunicipalReportPresentationConfig,
  locale?: string,
  translateClass?: (label: string) => string,
  translateTitle?: (title: string, id: string) => string,
  t?: (key: string, values?: Record<string, string>) => string,
  tHas?: (key: string) => boolean,
) {
  const recent = findGeneratedSectionText(analysis, docsContent, [
    "Tendência recente",
    "Tendencia recente",
    "Tendencia reciente",
    "Recent trend",
  ]);
  const context = findGeneratedSectionText(analysis, docsContent, [
    "Contexto histórico",
    "Contexto historico",
    "Historical context",
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
    const translatedLabel = translateClass ? translateClass(label) : label;
    const code = classRule(id)?.code ?? config.classes?.[id]?.code;
    return code ? `${translatedLabel} (${code})` : translatedLabel;
  };
  const translatedTitle = translateTitle ? translateTitle(analysis.title, analysis.id) : analysis.title;
  const affected = recentHistory.filter(({ dominantClass }) => dominantClass && !classRule(dominantClass.id)?.isNeutral).length;
  const previous = recentHistory.at(-2)?.dominantClass;

  const resolveHistoryTerm = (group: "phenomenon" | "neutralState" | "severityTerm", fallback: string) => {
    if (!t) return fallback;
    if (tHas) {
      if (tHas(`historyTerms.${group}.${analysis.id}`)) {
        try {
          const byId = t(`historyTerms.${group}.${analysis.id}`);
          if (byId && !byId.startsWith("historyTerms.")) return byId;
        } catch {
          // fallback
        }
      }
      if (tHas(`historyTerms.${group}.default`)) {
        try {
          const byDefault = t(`historyTerms.${group}.default`);
          if (byDefault && !byDefault.startsWith("historyTerms.")) return byDefault;
        } catch {
          // fallback
        }
      }
      return fallback;
    }
    try {
      const byId = t(`historyTerms.${group}.${analysis.id}`);
      if (byId && !byId.startsWith("historyTerms.")) return byId;
      const byDefault = t(`historyTerms.${group}.default`);
      if (byDefault && !byDefault.startsWith("historyTerms.")) return byDefault;
    } catch {
      // fallback
    }
    return fallback;
  };

  const phenomenon = resolveHistoryTerm("phenomenon", config.history.phenomenon);
  const neutralState = resolveHistoryTerm("neutralState", config.history.neutralState);
  const severityTerm = resolveHistoryTerm("severityTerm", config.history.severityTerm);

  let comparison = t ? t("historyNarrative.noPrevious") : "Não há mês anterior disponível para comparação.";
  if (previous && current.dominantClass.id === previous.id) {
    const prevClass = formatClass(previous.id, previous.label);
    comparison = t
      ? t("historyNarrative.stable", { prevClass })
      : `A classificação permaneceu estável em relação ao mês anterior, quando também predominava ${prevClass}.`;
  } else if (previous && classRule(current.dominantClass.id)?.isNeutral) {
    const prevClass = formatClass(previous.id, previous.label);
    comparison = t
      ? t("historyNarrative.improvement", { prevClass, phenomenon })
      : `Houve melhora em relação ao mês anterior, quando predominava ${prevClass}; no período atual não predomina condição de ${config.history.phenomenon}.`;
  } else if (previous && classRule(previous.id)?.isNeutral) {
    const prevClass = formatClass(previous.id, previous.label);
    const currClass = formatClass(current.dominantClass.id, current.dominantClass.label);
    comparison = t
      ? t("historyNarrative.worsening", { prevClass, currClass })
      : `Houve piora em relação ao mês anterior, quando predominava ${prevClass}; no período atual passou a predominar ${currClass}.`;
  } else if (previous && classRule(current.dominantClass.id)?.rank != null && classRule(previous.id)?.rank != null) {
    const prevClass = formatClass(previous.id, previous.label);
    const isWorsening = classRule(current.dominantClass.id)!.rank! > classRule(previous.id)!.rank!;
    comparison = t
      ? t(isWorsening ? "historyNarrative.worseningRank" : "historyNarrative.improvementRank", { prevClass })
      : `Houve ${isWorsening ? "agravamento" : "redução"} em relação ao mês anterior, quando predominava ${prevClass}.`;
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
  const maxClass = formatClass(maximum.dominantClass!.id, maximum.dominantClass!.label);
  const maxPeriod = formatReportPeriod(maximum.period, locale);
  const maximumText = t
    ? t("historyNarrative.maximumText", { maxClass, maxPeriod })
    : `${maxClass}, registrada em ${maxPeriod}`;
  const percentage = (count: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format((count / history.length) * 100);

  const firstPeriod = formatReportPeriod(history[0].period, locale);
  const recentFirstPeriod = formatReportPeriod(recentHistory[0].period, locale);
  const currentPeriod = formatReportPeriod(current.period, locale);
  const currClass = formatClass(current.dominantClass.id, current.dominantClass.label);
  const mostFreqClass = formatClass(mostFrequent[0], mostFrequent[1].label);
  const mostFreqPerc = percentage(mostFrequent[1].count);
  const neutralPerc = percentage(neutralCount);

  if (t) {
    return {
      recent: t("historyNarrative.recent", {
        title: translatedTitle,
        place: municipalityName,
        phenomenon,
        affected: String(affected),
        total: String(recentHistory.length),
        firstPeriod: recentFirstPeriod,
        currentPeriod,
        currClass,
        comparison,
      }),
      context: t("historyNarrative.context", {
        firstPeriod,
        currentPeriod,
        mostFreqClass,
        mostFreqPerc,
        neutralState,
        neutralPerc,
        severityTerm,
        maximumText,
      }),
    };
  }

  return {
    recent: `A série histórica de ${translatedTitle} registra que ${municipalityName} apresentou condição de ${config.history.phenomenon} em ${affected} dos últimos ${recentHistory.length} períodos analisados (${recentFirstPeriod} a ${currentPeriod}). No período de referência (${currentPeriod}), predomina ${currClass}. ${comparison}`,
    context: `No período ${firstPeriod}–${currentPeriod}, a classe predominante mais frequente foi ${mostFreqClass}, em ${mostFreqPerc}% dos períodos. A condição ${config.history.neutralState} predominou em ${neutralPerc}% do período. A maior ${config.history.severityTerm} observada foi ${maximumText}.`,
  };
}
