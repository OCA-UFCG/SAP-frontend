/**
 * O que cada número do tabelão significa, índice por índice.
 *
 * Conferido em 12/11/2026 contra a rota /api/municipal-report do site para
 * Campina Grande (2504009), Paraíba e Brasil. "Conferido" quer dizer que o
 * valor do tabelão bateu com o relatório atual (diferença ≤ 0,1); "difere"
 * quer dizer que o índice foi recalculado ou trocou de fonte depois de
 * 24/07/2026, quando o SQLite antigo foi gerado.
 */
export interface IndiceInfo {
  nome: string;
  /** distribuicao: um valor por classe, somando ~100. valor_unico: uma classe só. */
  tipo_valor: "distribuicao" | "valor_unico";
  significado_valor: string;
  unidade: string;
  /** id do mesmo índice no relatório atual da plataforma, se houver. */
  id_no_relatorio: string | null;
  observacao: string;
  /** Linha com todas as classes zeradas é "sem dado", não "0%". */
  zero_e_sem_dado: boolean;
}

const AREA = "% da área do território em cada classe; as classes somam ~100";

export const INDICES: Record<string, IndiceInfo> = {
  CDI_Test: {
    nome: "CDI – Índice Combinado de Seca",
    tipo_valor: "distribuicao",
    significado_valor: `${AREA}. Classes: Sem seca, Estágio 1, Estágio 2, Estágio 3 (o mais grave), Recuperação total, Recuperação parcial.`,
    unidade: "% da área",
    id_no_relatorio: "indice-combinado-de-seca-cdi",
    observacao:
      "Mensal no tabelão. O site hoje usa uma versão decendial (dias 1, 11 e 21 de cada mês) recalculada, então os números do site podem diferir.",
    zero_e_sem_dado: true,
  },
  anaseca: {
    nome: "Monitor de Secas (ANA)",
    tipo_valor: "distribuicao",
    significado_valor: `${AREA}. Severidade crescente: Sem seca, Seca fraca, moderada, grave, extrema, excepcional.`,
    unidade: "% da área",
    id_no_relatorio: "monitor-de-seca-ana",
    observacao:
      "Na conferência da equipe (12/11/2026), bateu com o relatório do site.",
    zero_e_sem_dado: true,
  },
  cemadenseca: {
    nome: "Índice Integrado de Secas (Cemaden)",
    tipo_valor: "distribuicao",
    significado_valor: `${AREA}. Severidade crescente: Condições normais, Seca fraca, moderada, severa, extrema, excepcional.`,
    unidade: "% da área",
    id_no_relatorio: null,
    observacao:
      "Não aparece mais no relatório do site; não foi possível conferir com a plataforma.",
    zero_e_sem_dado: true,
  },
  pob_total: {
    nome: "Pobreza total (CadÚnico)",
    tipo_valor: "valor_unico",
    significado_valor:
      "% das famílias inscritas no CadÚnico que estão em situação de pobreza.",
    unidade: "% das famílias do CadÚnico",
    id_no_relatorio: "percentual-de-pobreza-total-cadunico",
    observacao:
      "Na conferência da equipe (12/11/2026), bateu com o site. O valor de estado e do Brasil é a média simples dos municípios, sem pesar pelo número de famílias.",
    zero_e_sem_dado: true,
  },
  pob_urb: {
    nome: "Pobreza urbana (CadÚnico)",
    tipo_valor: "valor_unico",
    significado_valor:
      "% das famílias urbanas inscritas no CadÚnico que estão em situação de pobreza.",
    unidade: "% das famílias do CadÚnico",
    id_no_relatorio: "percentual-de-pobreza-urbano-cadunico",
    observacao:
      "Na conferência da equipe (12/11/2026), bateu com o site. Estado e Brasil são a média simples dos municípios.",
    zero_e_sem_dado: true,
  },
  pob_rural: {
    nome: "Pobreza rural (CadÚnico)",
    tipo_valor: "valor_unico",
    significado_valor:
      "% das famílias rurais inscritas no CadÚnico que estão em situação de pobreza.",
    unidade: "% das famílias do CadÚnico",
    id_no_relatorio: "percentual-de-pobreza-rural-cadunico",
    observacao:
      "Na conferência da equipe (12/11/2026), bateu com o site. Estado e Brasil são a média simples dos municípios.",
    zero_e_sem_dado: true,
  },
  s2id_secas_estiagens: {
    nome: "Registros de secas e estiagens (S2iD)",
    tipo_valor: "valor_unico",
    significado_valor:
      "Número de registros de seca ou estiagem no ano (contagem, não %). Estado e Brasil são a soma dos municípios.",
    unidade: "registros no ano",
    id_no_relatorio: "registros-de-secas-e-estiagens-do-s2id",
    observacao:
      "Os anos 2010, 2011, 2012, 2014 e 2016 não estão no tabelão. O site hoje usa uma contagem refeita, que difere desta.",
    zero_e_sem_dado: false,
  },
  indicearidez: {
    nome: "Índice de Aridez",
    tipo_valor: "distribuicao",
    significado_valor: `${AREA}. Classes: Árido, Semiárido, Subúmido seco, Úmido.`,
    unidade: "% da área",
    id_no_relatorio: "indice-de-aridez-br-dwgd",
    observacao:
      "Só os anos 1990, 2000, 2010 e 2020. O site hoje usa outra versão do índice (BR-DWGD e ERA5-Land, até 2024), com números diferentes.",
    zero_e_sem_dado: true,
  },
  terraibge: {
    nome: "Cobertura da Terra (IBGE)",
    tipo_valor: "distribuicao",
    significado_valor: `${AREA}. 12 classes de uso e cobertura (área artificial, agrícola, pastagem, vegetação florestal etc.).`,
    unidade: "% da área",
    id_no_relatorio: "cobertura-da-terra-ibge-s",
    observacao:
      "Anos 2000, 2010, 2014, 2016, 2018 e 2020. O site recalculou; diferenças de até alguns pontos percentuais.",
    zero_e_sem_dado: true,
  },
  carbonoembrapa: {
    nome: "Carbono Orgânico do Solo (Embrapa)",
    tipo_valor: "distribuicao",
    significado_valor: `${AREA}. Faixas de carbono orgânico no solo, em g/kg: <5, 5-6, 6-8, 8-10, 10-16, >16.`,
    unidade: "% da área",
    id_no_relatorio: "carbono-organico-do-solo-embrapa",
    observacao:
      "Na conferência da equipe (12/11/2026), bateu com o site. Um único ano (2020).",
    zero_e_sem_dado: true,
  },
  deg: {
    nome: "Índice de Degradação da Terra",
    tipo_valor: "distribuicao",
    significado_valor: `${AREA}. Classes: Nível 5 (mais degradado), Nível 4, 3, 2, Nível 1 (menos degradado), Conservado.`,
    unidade: "% da área",
    id_no_relatorio: "indice-de-degradacao-da-terra",
    observacao:
      "Só 2001 e 2021. Na conferência da equipe (12/11/2026), municípios bateram com o site; estados e Brasil diferem do site (o site recalcula pelo Earth Engine).",
    zero_e_sem_dado: true,
  },
  ods: {
    nome: "Dinâmica da Degradação da Terra (ODS 15.3.1)",
    tipo_valor: "distribuicao",
    significado_valor: `${AREA}. Classes: Degradando, Estável, Melhorando.`,
    unidade: "% da área",
    id_no_relatorio: "dinamica-da-degradacao-da-terra-ods-15-3-1",
    observacao:
      "Só 2021. Na conferência da equipe (12/11/2026), municípios bateram com o site; estados e Brasil diferem do site.",
    zero_e_sem_dado: true,
  },
  prodprimariabruta: {
    nome: "Produção Primária Bruta (MODIS)",
    tipo_valor: "distribuicao",
    significado_valor: `${AREA}. Faixas de produção primária bruta, em kg de carbono por m² no ano: <0,7; 0,7-1,3; 1,3-1,8; 1,8-2,4; 2,4-2,9; >2,9.`,
    unidade: "% da área",
    id_no_relatorio: "producao-primaria-bruta",
    observacao:
      "O site recalculou este índice; para municípios a diferença é grande. Cerca de 790 municípios não têm dado em parte dos anos.",
    zero_e_sem_dado: true,
  },
  prev_anomalia_precipitacao: {
    nome: "Previsão de anomalia de precipitação (CPTEC/INPE)",
    tipo_valor: "distribuicao",
    significado_valor: `${AREA}. Faixas de anomalia de chuva prevista, em mm/mês: < -90, -90 a -30, -30 a 0, 0 a 30, 30 a 90, > 90. Negativo = mais seco que o normal.`,
    unidade: "% da área",
    id_no_relatorio: "previsao-anomalia-precipitacao-cptec-inpe",
    observacao:
      "PREVISÃO antiga, feita antes de 24/07/2026 para maio a outubro de 2026. Não é medição. Para previsão atual, use o relatório do site.",
    zero_e_sem_dado: true,
  },
};
