/**
 * As regras de tradução do Relatório Automático: título do índice, rótulo de
 * classe e nota metodológica.
 *
 * Vivem fora do componente porque a prévia do catálogo mostra o mesmo texto
 * antes de publicar. Recebem as funções de tradução por parâmetro em vez de
 * chamar `useTranslations`, para que a regra continue testável sem React e
 * para que quem chama escolha o dicionário.
 *
 * @example
 * translateAnalysisTitle(analysis, t, t.has, tModules, tModules.has);
 */

import type {
  MunicipalReportAnalysis,
  MunicipalReportDocsContent,
} from "@/contracts/municipalReport";
import { getReportDocsText } from "@/utils/municipalReportNarrative";
import { slugifyTranslationKey } from "@/utils/translations";

function slugifyLabelKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/</g, "menor-que")
    .replace(/>/g, "maior-que")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export function translateAnalysisTitle(
  analysis: MunicipalReportAnalysis,
  tReport: (key: string) => string,
  tReportHas: (key: string) => boolean,
  tModules: (key: string) => string,
  tModulesHas: (key: string) => boolean,
) {
  if (tReportHas(`indicators.${analysis.id}.title`)) {
    return tReport(`indicators.${analysis.id}.title`);
  }
  const slug = slugifyTranslationKey(analysis.title);
  if (tReportHas(`indicators.${slug}.title`)) {
    return tReport(`indicators.${slug}.title`);
  }
  const moduleKey = `Layers.${slug}.title`;
  if (tModulesHas(moduleKey)) {
    return tModules(moduleKey);
  }
  return analysis.title;
}

export function translateClassLabel(
  label: string,
  tReport: (key: string) => string,
  tReportHas: (key: string) => boolean,
  tCaption: (key: string) => string,
  tCaptionHas: (key: string) => boolean,
) {
  const slug = slugifyLabelKey(label);
  if (tCaptionHas(`labels.${slug}`)) {
    return tCaption(`labels.${slug}`);
  }
  if (tReportHas(`classes.${slug}`)) {
    return tReport(`classes.${slug}`);
  }
  return label;
}

export function translateAnalysisMethodology(
  analysis: MunicipalReportAnalysis,
  docsContent: MunicipalReportDocsContent | null,
  presentationMethodology: string,
  tReport: (key: string) => string,
  tReportHas: (key: string) => boolean,
  tModules: (key: string) => string,
  tModulesHas: (key: string) => boolean,
  locale?: string,
) {
  const docsText = getReportDocsText(docsContent, analysis.title, locale);
  if (docsText) return docsText;

  if (tReportHas(`indicators.${analysis.id}.methodology`)) {
    return tReport(`indicators.${analysis.id}.methodology`);
  }
  const slug = slugifyTranslationKey(analysis.title);
  if (tReportHas(`indicators.${slug}.methodology`)) {
    return tReport(`indicators.${slug}.methodology`);
  }
  const moduleKey = `Layers.${slug}.description`;
  if (tModulesHas(moduleKey)) {
    return tModules(moduleKey);
  }
  if (
    presentationMethodology ===
      "Indicador territorial disponibilizado na plataforma SEDES." &&
    tReportHas("indicators.defaultMethodology")
  ) {
    return tReport("indicators.defaultMethodology");
  }
  return presentationMethodology;
}
