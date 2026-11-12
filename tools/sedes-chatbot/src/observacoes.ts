/**
 * Ressalvas escritas à mão sobre índices do catálogo, para o chatbot não
 * afirmar algo que o dado não sustenta. O servidor lê este arquivo a cada
 * pedido (corrigir uma ressalva não exige montar o tabelão de novo), e o
 * tabelão guarda uma cópia na coluna `indices.observacao`. O resto da
 * descrição de cada índice vem do próprio catálogo.
 *
 * Conferido em 12/11/2026 comparando o cadastro com as tabelas do Earth Engine.
 */
export const OBSERVACOES: Record<string, string> = {
  "previsao-temperatura-mensal-probabilidade-inmet":
    "ATENÇÃO: no cadastro do site, este índice lê a mesma tabela da previsão de PRECIPITAÇÃO mensal por probabilidade do INMET (Estatisticas_Multinivel_INMET_Prev_P_mensal_Tercil). Os números podem ser de chuva, não de temperatura; avise o usuário antes de usá-los.",
  "mortalidade-infatil":
    "O site mostra a unidade como '%', mas taxa de mortalidade infantil costuma ser medida por mil nascidos vivos. Diga só o número e que a unidade exibida no site é '%', sem afirmar a unidade correta.",
  "registros-de-secas-e-estiagens-do-s2id":
    "Na planilha publicada hoje, quase todo município tem 0 ou 1 por ano (em julho de 2026 havia contagens de até 7), e a série vai de 1991, embora a descrição do catálogo diga 2004 a 2025. Repita o número como o site mostra, chamando de 'registros', sem afirmar se 1 quer dizer um registro ou 'houve registro'. Estados, Brasil e recortes são a soma dos municípios.",
  "produto-interno-bruto": "Valor em reais (não em milhares).",
  "indice-de-desenvolvimento-humano":
    "Valor entre 0 e 1. O relatório do site arredonda para 1 casa (0,7); o tabelão guarda o valor completo.",
};
