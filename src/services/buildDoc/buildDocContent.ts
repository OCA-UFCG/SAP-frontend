import { getDocTemplate } from "./buildDocTemplate";
import { getTemplateData } from "./buildTemplateData";
import type { DocsContent } from "./buildDocTemplate";
import type { TemplateData } from "./buildTemplateData";

type BuildDocContentInput = {
  themes: string[];
  city: string;
  state: string;
  month: string | number;
  year: string | number;
  ibgeId: string;
  period: string;
};

export async function buildDocContent({
  themes,
  city,
  state,
  month,
  year,
  ibgeId,
  period,
}: BuildDocContentInput) {
  const baseTemplate = await getDocTemplate({
    themes,
    city,
    state,
    month,
    year,
  });

  const templateData = await getTemplateData(ibgeId, period);

  return populateDocContent(baseTemplate, templateData);
}

function populateTemplate(template: string, data: TemplateData): string {
  const regex = /\[([^\]]+)\]/g;
  const normalizedData = normalizeTemplateDataKeys(data);
  const placeholderCounters = new Map<string, number>();

  return template.replace(regex, (match, key: string) => {
    const cleanKey = key.trim();
    const normalizedKey = normalizeTemplateKey(cleanKey);
    const value =
      data[cleanKey] ??
      normalizedData[normalizedKey] ??
      getAliasedTemplateValue(normalizedKey, normalizedData, placeholderCounters);

    if (value === undefined || value === null) {
      return match;
    }

    return String(value);
  });
}

function populateDocContent(template: DocsContent, data: TemplateData): DocsContent {
  return Object.fromEntries(
    Object.entries(template).map(([theme, sections]) => [
      theme,
      sections.map((section) => {
        const title = populateTemplate(section.title, data);
        const textTemplate = getGeneratedSectionOverride(theme, title, data) ?? section.text;

        return {
          title,
          text: populateTemplate(textTemplate, data),
        };
      }),
    ]),
  );
}

function getGeneratedSectionOverride(theme: string, title: string, data: TemplateData) {
  if (theme !== "DROUGHT_MONITOR") return undefined;

  const normalizedTitle = normalizeTemplateKey(title);
  if (normalizedTitle.includes("tendencia_recente")) {
    return typeof data.texto_tendencia_recente_seca === "string"
      ? data.texto_tendencia_recente_seca
      : undefined;
  }

  if (normalizedTitle.includes("contexto_historico")) {
    return typeof data.texto_contexto_historico_seca === "string"
      ? data.texto_contexto_historico_seca
      : undefined;
  }

  return undefined;
}

function getAliasedTemplateValue(
  normalizedKey: string,
  data: TemplateData,
  counters: Map<string, number>,
) {
  const sequentialAliases: Record<string, string[]> = {
    xx: ["percentual_freq_seca", "percentual_sem_seca"],
  };
  const aliases: Record<string, string> = {
    seca_classe: "classe_seca",
    percentual: "percentual_seca",
    x: "qtd_meses_com_seca",
    mes_ano_inicio: "mes_ano_inicio_tendencia",
    mes_ano_fim: "periodo_seca",
    mantendo_agravando_amenizando: "status_tendencia_seca",
    classe_anterior: "classe_seca_anterior",
    ano_inicio: "ano_inicio_historico",
    ano_fim: "ano_fim_historico",
    classe_mais_frequente: "classe_seca_mais_frequente",
    classe_maxima: "classe_seca_maxima",
    mes_ano_mais_severo: "periodos_seca_maxima",
  };
  const sequence = sequentialAliases[normalizedKey];

  if (sequence) {
    const index = counters.get(normalizedKey) ?? 0;
    counters.set(normalizedKey, index + 1);

    return data[sequence[index] ?? sequence[sequence.length - 1]];
  }

  const alias = aliases[normalizedKey];

  return alias ? data[alias] : undefined;
}

function normalizeTemplateDataKeys(data: TemplateData): TemplateData {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      normalizeTemplateKey(key),
      value,
    ]),
  );
}

function normalizeTemplateKey(key: string) {
  return key
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
