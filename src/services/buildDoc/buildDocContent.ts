import { getDocTemplate } from "./buildDocTemplate";
import { getTemplateData } from "./buildTemplateData";
import type { DocsContent } from "./buildDocTemplate";
import type { TemplateData } from "./buildTemplateData";
import type { TimingObserver } from "@/utils/serverTiming";
import type {
  MunicipalReportData,
  MunicipalReportDocsContent,
} from "@/contracts/municipalReport";
import { formatPercentage } from "@/utils/municipalReportValue";

const REPORT_LOCALE = "pt-BR";
const TWO_DIGIT_PERCENTAGE_KEYS = new Set(["soma_percentual_deg_n3_n4_n5"]);

function formatTemplateNumber(key: string, value: number): string {
  if (TWO_DIGIT_PERCENTAGE_KEYS.has(key)) {
    return formatPercentage(value, REPORT_LOCALE, 2);
  }
  if (
    key.startsWith("percentual_") ||
    key.startsWith("frequencia_") ||
    key === "variacao_deg_pontos"
  ) {
    return formatPercentage(value, REPORT_LOCALE);
  }
  return String(value);
}

type BuildDocContentInput = {
  themes: string[];
  city: string;
  state: string;
  month: string | number;
  year: string | number;
  ibgeId: string;
  period: string;
  onTiming?: TimingObserver;
  report?: MunicipalReportData;
  /**
   * Texto escrito no catálogo, por camada. Substitui o bloco
   * `[layer: <id>]` do Google Docs para as camadas que o trouxerem.
   */
  catalogSectionsByTheme?: MunicipalReportDocsContent;
};

/**
 * As seções do Google Docs, ou nada quando o documento não pôde ser lido e o
 * catálogo já respondeu pelo texto.
 *
 * Um índice cujo texto vem do catálogo não deve depender do documento para
 * existir no relatório — é justamente o acoplamento que o catálogo veio
 * remover. Sem texto nenhum do catálogo a falha continua sendo fatal, porque aí
 * não há relatório a montar.
 */
async function loadDocsSections(
  input: Parameters<typeof getDocTemplate>[0],
  hasCatalogSections: boolean,
): Promise<DocsContent> {
  try {
    return await getDocTemplate(input);
  } catch (error) {
    if (!hasCatalogSections) throw error;
    console.warn(
      "[municipalReportDocs] DOCS_DEFAULT indisponível; usando apenas o texto escrito no catálogo.",
      error,
    );
    return {};
  }
}

export async function buildDocContent({
  themes,
  city,
  state,
  month,
  year,
  ibgeId,
  period,
  onTiming,
  report,
  catalogSectionsByTheme,
}: BuildDocContentInput) {
  const templateStartedAt = performance.now();
  const catalogSections = catalogSectionsByTheme ?? {};
  const docsSections = await loadDocsSections(
    { themes, city, state, month, year },
    Object.keys(catalogSections).length > 0,
  );
  // O texto do catálogo entra depois: para uma camada que o publicou, ele
  // substitui o bloco do documento em vez de se somar a ele.
  const baseTemplate: DocsContent = { ...docsSections, ...catalogSections };
  onTiming?.(
    "docs_template",
    performance.now() - templateStartedAt,
    "Leitura do template no Google Docs",
  );

  const dataStartedAt = performance.now();
  const templateData = await getTemplateData(ibgeId, period, onTiming, report);
  onTiming?.(
    "docs_data",
    performance.now() - dataStartedAt,
    "Montagem dos dados do template",
  );

  const populateStartedAt = performance.now();
  const content = populateDocContent(baseTemplate, templateData);
  onTiming?.(
    "docs_populate",
    performance.now() - populateStartedAt,
    "Substituição das variáveis do template",
  );
  return content;
}

function populateTemplate(
  theme: string,
  template: string,
  data: TemplateData,
): string {
  const regex = /\[([^\]]+)\]/g;
  const normalizedData = normalizeTemplateDataKeys(data);
  const placeholderCounters = new Map<string, number>();

  return template.replace(regex, (match, key: string) => {
    const cleanKey = key.trim();
    const normalizedKey = normalizeTemplateKey(cleanKey);
    let resolvedKey = normalizedKey;
    let value = data[cleanKey] ?? normalizedData[normalizedKey];

    if (value === undefined || value === null) {
      const aliasedKey = getAliasedTemplateKey(
        theme,
        normalizedKey,
        placeholderCounters,
      );
      if (aliasedKey) {
        resolvedKey = aliasedKey;
        value = normalizedData[aliasedKey];
      }
    }

    if (value === undefined || value === null) {
      return match;
    }

    if (typeof value === "number") {
      return formatTemplateNumber(resolvedKey, value);
    }
    return String(value);
  });
}

export function populateDocContent(
  template: DocsContent,
  data: TemplateData,
): DocsContent {
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

function getAliasedTemplateKey(
  theme: string,
  normalizedKey: string,
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

    return sequence[index] ?? sequence[sequence.length - 1];
  }

  return aliasesByTheme[theme]?.[normalizedKey];
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
