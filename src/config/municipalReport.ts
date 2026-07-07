export interface MunicipalReportLayerConfig {
  panelLayerId: string;
  alias: string;
  title: string;
  order: number;
}

export const MUNICIPAL_REPORT_LAYERS: readonly MunicipalReportLayerConfig[] = [
  { panelLayerId: "anaseca", alias: "seca", title: "Monitor de Secas", order: 10 },
  { panelLayerId: "indicearidez", alias: "aridez", title: "Índice de Aridez", order: 20 },
  { panelLayerId: "deg", alias: "degradacao", title: "Índice de Degradação da Terra", order: 30 },
] as const;
