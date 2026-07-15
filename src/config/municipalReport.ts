export interface MunicipalReportLayerConfig {
  panelLayerId: string;
  alias: string;
  title: string;
  order: number;
  periods?: string[];
  timeSeriesLocationKey?: "br";
  presentation?: MunicipalReportPresentationConfig;
}

export interface MunicipalReportClassPresentation {
  code?: string;
  description?: string;
  rank?: number;
  isNeutral?: boolean;
}

export interface MunicipalReportPresentationConfig {
  sectionColor: string;
  coverageContext: string;
  methodology: string;
  history?: {
    phenomenon: string;
    neutralState: string;
    severityTerm: string;
    classes: Record<string, MunicipalReportClassPresentation>;
  };
  classes?: Record<string, MunicipalReportClassPresentation>;
}

export const MUNICIPAL_REPORT_LAYERS: readonly MunicipalReportLayerConfig[] = [
  {
    panelLayerId: "anaseca", alias: "seca", title: "Monitor de Secas", order: 10,
    presentation: {
      sectionColor: "#176b39",
      coverageContext: "enquadrada nesse nível de severidade",
      methodology: "Produzido pela Agência Nacional de Águas e Saneamento Básico (ANA), com disponibilidade mensal e classificação da severidade da seca.",
      history: {
        phenomenon: "seca", neutralState: "sem seca", severityTerm: "severidade",
        classes: {
          "sem-seca": { code: "S0", rank: 0, isNeutral: true, description: "Condições normais de umidade" },
          "seca-fraca": { code: "D0", rank: 1, description: "Impactos de curto prazo possíveis" },
          "seca-moderada": { code: "D1", rank: 2, description: "Perdas nas culturas e pastagens" },
          "seca-severa": { code: "D2", rank: 3, description: "Perdas generalizadas" },
          "seca-grave": { code: "D2", rank: 3, description: "Perdas generalizadas" },
          "seca-extrema": { code: "D3", rank: 4, description: "Perdas excepcionais e crise hídrica" },
          "seca-excepcional": { code: "D4", rank: 5, description: "Condição mais severa da classificação" },
        },
      },
    },
  },
  {
    panelLayerId: "indicearidez", alias: "aridez", title: "Índice de Aridez", order: 20,
    presentation: {
      sectionColor: "#795548", coverageContext: "enquadrada nessa zona climática",
      methodology: "Calculado pela razão entre precipitação anual e evapotranspiração potencial, com referências decenais disponíveis na plataforma.",
    },
  },
  {
    panelLayerId: "deg", alias: "degradacao", title: "Índice de Degradação da Terra", order: 30,
    presentation: {
      sectionColor: "#2e7d32", coverageContext: "classificada nesse nível",
      methodology: "Indicador territorial produzido para caracterizar diferentes níveis de conservação e degradação do solo e da cobertura vegetal.",
      classes: {
        conservado: { description: "Vegetação e solo sem sinais de degradação" },
        "nivel-1": { description: "Início de degradação da cobertura" },
        "nivel-2": { description: "Perda parcial de biomassa e solo" },
        "nivel-3": { description: "Perda acentuada; vegetação comprometida" },
        "nivel-4": { description: "Solo exposto, irreversível sem intervenção" },
        "nivel-5": { description: "Nível mais elevado de degradação" },
      },
    },
  },
  { panelLayerId: "carbonoembrapa", alias: "carbono", title: "Carbono", order: 40 },
  { panelLayerId: "prev_anomalia_precipitacao", alias: "anomalia_precipitacao", title: "Previsão: Anomalia de Precipitação", order: 50 },
  { panelLayerId: "CDI_Test", alias: "cdi", title: "Índice Composto de Seca (CDI)", order: 60 },
  { panelLayerId: "pob_total", alias: "pobreza", title: "Famílias em situação de pobreza", order: 70 },
  { panelLayerId: "cemadenseca", alias: "cemaden_seca", title: "Cemaden: Seca", order: 80 },
  { panelLayerId: "ods", alias: "ods", title: "Objetivos de Desenvolvimento Sustentável", order: 90 },
  { panelLayerId: "prodprimariabruta", alias: "producao_primaria_bruta", title: "Produção Primária Bruta", order: 100 },
  { panelLayerId: "terraibge", alias: "cobertura_terra", title: "Cobertura da Terra", order: 110 },
  {
    panelLayerId: "s2id_secas_estiagens",
    alias: "s2id_secas_estiagens",
    title: "Registros de Secas e Estiagens (2004-2025)",
    order: 120,
    timeSeriesLocationKey: "br",
  },
] as const;

export function getMunicipalReportLayerConfig(analysisId: string) {
  return MUNICIPAL_REPORT_LAYERS.find((layer) => layer.panelLayerId === analysisId);
}

const DEFAULT_REPORT_PRESENTATION: MunicipalReportPresentationConfig = {
  sectionColor: "#176b39",
  coverageContext: "classificada nessa categoria",
  methodology: "Indicador territorial disponibilizado na plataforma SEDES.",
};

export function getMunicipalReportPresentation(analysisId: string) {
  return getMunicipalReportLayerConfig(analysisId)?.presentation
    ?? DEFAULT_REPORT_PRESENTATION;
}
