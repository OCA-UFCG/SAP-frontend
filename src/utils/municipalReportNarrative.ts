import type { MunicipalReportAnalysis, MunicipalReportDocsContent } from "@/contracts/municipalReport";
import { getMunicipalReportLayerConfig } from "@/config/municipalReport";

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

function findGeneratedSectionText(
  analysis: MunicipalReportAnalysis,
  docsContent: MunicipalReportDocsContent | null,
  sectionTitles: string[],
) {
  const theme = getMunicipalReportLayerConfig(analysis.id)?.docsTheme;
  if (!theme || !docsContent?.[theme]) return null;

  const normalizedTitles = new Set(sectionTitles.map(normalizeSectionTitle));
  return docsContent[theme].find((section) =>
    sectionTitleMatches(section.title, normalizedTitles),
  )?.text.trim() || null;
}

export function buildSituationNarrative(
  analysis: MunicipalReportAnalysis,
  docsContent: MunicipalReportDocsContent | null,
) {
  return findGeneratedSectionText(analysis, docsContent, [
    "Situação atual",
    "Situacao atual",
  ]);
}

export function buildHistoryNarrative(
  analysis: MunicipalReportAnalysis,
  docsContent: MunicipalReportDocsContent | null,
) {
  const recent = findGeneratedSectionText(analysis, docsContent, [
    "Tendência recente",
    "Tendencia recente",
  ]);
  const context = findGeneratedSectionText(analysis, docsContent, [
    "Contexto histórico",
    "Contexto historico",
  ]);

  return recent || context ? { recent, context } : null;
}
