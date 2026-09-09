import type { MunicipalReportDocsSection } from "@/contracts/municipalReport";

/**
 * Uma variável que o operador pode escrever entre colchetes no texto do
 * relatório, e que o servidor troca pelo dado do município antes de exibir.
 *
 * A lista existe para a tela poder mostrar exatamente o que funciona: um
 * colchete sem variável correspondente sobrevive literalmente até o relatório
 * (`populateTemplate` devolve o próprio `[texto]` quando não encontra a chave),
 * então prometer uma variável que não existe é pior do que não oferecer nenhuma.
 */
export interface CatalogReportVariable {
  token: string;
  description: string;
  example: string;
}

/**
 * As variáveis genéricas resolvem para a camada da própria seção: `[classe]`
 * vira `classe_<id da camada>` em `getAliasedTemplateKey`. É o que permite
 * escrever o mesmo texto para qualquer índice sem saber o id gerado.
 */
export const CATALOG_REPORT_VARIABLES: readonly CatalogReportVariable[] = [
  {
    token: "[indice]",
    description: "Nome deste índice, como publicado no catálogo.",
    example: "Monitor de Secas da ANA",
  },
  {
    token: "[municipio]",
    description: "Nome do município do relatório.",
    example: "Campina Grande",
  },
  {
    token: "[uf]",
    description: "Sigla do estado do município.",
    example: "PB",
  },
  {
    token: "[classe]",
    description: "Classe predominante deste índice no município.",
    example: "Semiárido",
  },
  {
    token: "[percentual]",
    description:
      "Quanto da área do município está na classe predominante, sem o sinal de %.",
    example: "83,4",
  },
  {
    token: "[periodo]",
    description: "Período analisado, como está publicado no índice.",
    example: "2024-09",
  },
  {
    token: "[periodo_extenso]",
    description: "O mesmo período escrito por extenso, para usar em frases.",
    example: "setembro de 2024",
  },
  {
    token: "[periodo_referencia]",
    description: "Período que o usuário pediu ao gerar o relatório.",
    example: "setembro de 2024",
  },
  {
    token: "[data_geracao]",
    description: "Data em que o relatório foi gerado.",
    example: "03/09/2026",
  },
];

/**
 * O texto que um índice novo já traz preenchido.
 *
 * Ele é genérico de propósito, mas precisa ser **publicável sem edição**: um
 * índice do catálogo não tem seção no Google Docs, então se o operador não
 * editar nada, é este texto que o cidadão lê. Por isso nenhuma frase aqui é
 * instrução para o operador — as instruções ficam nos `placeholder` dos campos
 * e no guia da seção.
 *
 * A primeira seção chama-se "Situação atual" porque esse título substitui a
 * frase que o relatório monta sozinho; é ela que demonstra onde entra dado.
 */
export const DEFAULT_CATALOG_REPORT_SECTIONS: readonly MunicipalReportDocsSection[] =
  [
    {
      title: "Situação atual",
      text: "No município de [municipio] — [uf], [percentual]% do seu território está na classe [classe], conforme o [indice], no período de [periodo_extenso].",
    },
    {
      title: "O que este índice mede",
      text: "Este índice classifica o território em faixas e informa quanto da área do município está em cada faixa. A tabela desta seção traz a distribuição completa das classes no período analisado, o gráfico mostra como essa distribuição variou ao longo da série e o mapa mostra onde cada classe ocorre dentro do município.",
    },
    {
      title: "Como interpretar os resultados",
      text: "A classe predominante indica a faixa que ocupa a maior parte da área de [municipio] — [uf] no período analisado, e não a condição de todo o município: faixas menos extensas podem concentrar justamente as áreas mais críticas. A leitura fica mais completa quando comparada com os períodos anteriores da série e com os demais índices deste relatório.",
    },
    {
      title: "Limitações de uso",
      text: "Os valores desta seção resultam do cruzamento entre a grade do índice e o limite territorial do município, e por isso descrevem a área municipal como um todo, sem detalhar localidades. Para decisões locais, use este resultado junto com informações de campo.",
    },
  ];

export const DEFAULT_CATALOG_REPORT_METHODOLOGY =
  "Índice territorial calculado a partir de dados do Google Earth Engine e publicado pelo catálogo de índices da plataforma SEDES.";

/**
 * A dica cinza de cada campo. Fica separada do texto padrão porque tem função
 * oposta: aqui é instrução para quem escreve, e por isso nunca é publicada.
 */
export const CATALOG_REPORT_SECTION_HINTS: readonly string[] = [
  "Frase de abertura da seção, com o dado do município. Substitui a frase que o relatório monta sozinho.",
  "O que o índice representa e qual fenômeno ele acompanha. Vale para todos os municípios.",
  "O que um valor alto ou baixo significa na prática para quem lê o relatório.",
  "O que este índice não responde, e o cuidado que a leitura exige.",
];
