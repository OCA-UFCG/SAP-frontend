import type { MunicipalReportDocsSection } from "@/contracts/municipalReport";

/**
 * Uma variável que o operador pode escrever entre colchetes no texto do
 * relatório, e que o servidor troca pelo dado do território antes de exibir.
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
    token: "[no_territorio]",
    description:
      "Abre a frase com o território do relatório, já com a preposição certa. Use no começo da frase.",
    example: "No município de Campina Grande — PB",
  },
  {
    token: "[territorio]",
    description:
      "Só o nome do território do relatório; no município vem acompanhado da UF.",
    example: "Campina Grande — PB",
  },
  {
    token: "[recorte]",
    description:
      "O tipo de território do relatório: município, estado, região, bioma, semiárido, ASD ou país.",
    example: "município",
  },
  {
    token: "[do_territorio]",
    description:
      "O território no meio da frase: “quanto da área [do_territorio] está…”.",
    example: "do município de Campina Grande — PB",
  },
  {
    token: "[municipio-uf]",
    description:
      "O mesmo que [territorio]: nome e UF do município. Em outro recorte, mostra o território do relatório.",
    example: "Campina Grande — PB",
  },
  {
    token: "[municipio]",
    description:
      "Nome do território, sem a UF. Num relatório de estado, bioma ou Brasil é o nome daquele recorte.",
    example: "Campina Grande",
  },
  {
    token: "[uf]",
    description:
      "Sigla do estado. Fica vazia nos recortes que não têm uma, como bioma e Brasil.",
    example: "PB",
  },
  {
    token: "[classe]",
    description: "Classe predominante deste índice no território.",
    example: "Semiárido",
  },
  {
    token: "[percentual]",
    description:
      "Quanto da área do território está na classe predominante, sem o sinal de %.",
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
      text: "[no_territorio], [percentual]% do território está na classe [classe], conforme o [indice], no período de [periodo_extenso].",
    },
    {
      title: "O que este índice mede",
      text: "Este índice classifica o território em faixas e informa quanto da área [do_territorio] está em cada faixa. A tabela desta seção traz a distribuição completa das classes no período analisado, o gráfico mostra como essa distribuição variou ao longo da série e o mapa mostra onde cada classe ocorre dentro [do_territorio].",
    },
    {
      title: "Como interpretar os resultados",
      text: "A classe predominante indica a faixa que ocupa a maior parte da área [do_territorio] no período analisado, e não a condição do território inteiro: faixas menos extensas podem concentrar justamente as áreas mais críticas. A leitura fica mais completa quando comparada com os períodos anteriores da série e com os demais índices deste relatório.",
    },
    {
      title: "Limitações de uso",
      text: "Os valores desta seção resultam do cruzamento entre a grade do índice e o limite territorial [do_territorio], e por isso descrevem essa área como um todo, sem detalhar localidades. Para decisões locais, use este resultado junto com informações de campo.",
    },
  ];

export const DEFAULT_CATALOG_REPORT_METHODOLOGY =
  "Índice territorial calculado a partir de dados do Google Earth Engine e publicado pelo catálogo de índices da plataforma SEDES.";

/**
 * A dica cinza de cada campo. Fica separada do texto padrão porque tem função
 * oposta: aqui é instrução para quem escreve, e por isso nunca é publicada.
 */
export const CATALOG_REPORT_SECTION_HINTS: readonly string[] = [
  "Frase de abertura da seção, com o dado do território. Substitui a frase que o relatório monta sozinho.",
  "O que o índice representa e qual fenômeno ele acompanha. Vale para qualquer território.",
  "O que um valor alto ou baixo significa na prática para quem lê o relatório.",
  "O que este índice não responde, e o cuidado que a leitura exige.",
];
