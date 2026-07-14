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

function populateTemplate(theme: string, template: string, data: TemplateData): string {
  const regex = /\[([^\]]+)\]/g;
  const normalizedData = normalizeTemplateDataKeys(data);
  const placeholderCounters = new Map<string, number>();

  return template.replace(regex, (match, key: string) => {
    const cleanKey = key.trim();
    const normalizedKey = normalizeTemplateKey(cleanKey);
    const value =
      data[cleanKey] ??
      normalizedData[normalizedKey] ??
      getAliasedTemplateValue(theme, normalizedKey, normalizedData, placeholderCounters);

    if (value === undefined || value === null) {
      return match;
    }

    return String(value);
  });
}

export function populateDocContent(template: DocsContent, data: TemplateData): DocsContent {
  return Object.fromEntries(
    Object.entries(template).map(([theme, sections]) => [
      theme,
      sections.map((section) => {
        const title = populateTemplate(theme, section.title, data);

        return {
          title,
          text: populateTemplate(theme, section.text, data),
        };
      }),
    ]),
  );
}

function getAliasedTemplateValue(
  theme: string,
  normalizedKey: string,
  data: TemplateData,
  counters: Map<string, number>,
) {
  const aliasesByTheme: Record<string, Record<string, string>> = {
    DROUGHT_MONITOR: {
      seca_classe: "classe_seca",
      percentual: "percentual_seca",
      mes_ano: "periodo_seca",
      mes_ano_inicio: "mes_ano_inicio_tendencia",
      mes_ano_fim: "periodo_seca",
      mantendo_agravando_amenizando: "status_tendencia_seca",
      classe_anterior: "classe_seca_anterior",
      ano_inicio: "ano_inicio_historico",
      ano_fim: "ano_fim_historico",
      classe_mais_frequente: "classe_seca_mais_frequente",
      classe_maxima: "classe_seca_maxima",
      mes_ano_mais_severo: "periodos_seca_maxima",
    },
    ARIDITY_INDEX: {
      classe: "classe_aridez",
      classe_de_aridez: "classe_aridez",
      percentual: "percentual_aridez",
      mes_ano: "periodo_aridez",
      estabilidade_aridificacao_amenizacao: "status_tendencia_aridez",
    },
    DEGRADATION_INDEX: {
      percentual: "percentual_degradacao",
      mes_ano: "periodo_degradacao",
      aumento_reducao_estabilidade: "status_tendencia_degradacao",
      acrescimo_decrescimo: "acrescimo_decrescimo_deg",
      e_nao_e: "compatibilidade_com_seca",
    },
  };
  const sequentialAliasesByTheme: Record<string, Record<string, string[]>> = {
    DROUGHT_MONITOR: {
      x: ["qtd_meses_com_seca"],
      xx: ["percentual_freq_seca", "percentual_sem_seca"],
    },
    DEGRADATION_INDEX: {
      classe: ["classe_degradacao", "classe_maior_variacao_deg"],
      x: [
        "soma_percentual_deg_n3_n4_n5",
        "percentual_deg_conservado",
        "percentual_deg_n1",
        "percentual_deg_n2",
        "percentual_deg_n3",
        "percentual_deg_n4",
        "percentual_deg_n5",
        "variacao_deg_pontos",
      ],
    },
  };
  const sequence = sequentialAliasesByTheme[theme]?.[normalizedKey];

  if (sequence) {
    const index = counters.get(normalizedKey) ?? 0;
    counters.set(normalizedKey, index + 1);

    return data[sequence[index] ?? sequence[sequence.length - 1]];
  }

  const alias = aliasesByTheme[theme]?.[normalizedKey];

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
