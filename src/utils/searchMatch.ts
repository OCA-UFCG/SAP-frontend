/**
 * Quão bem um resultado casa com a busca: 0 quando o texto digitado é o nome
 * inteiro, 1 quando é o começo dele, 2 quando aparece só no meio e `null`
 * quando não aparece. Recebe a busca e os textos já passados por `normalize`.
 *
 * Existe para ordenar as sugestões: a primeira é a que o Enter escolhe, e em
 * ordem alfabética "joao pessoa" levava a Coronel João Pessoa (RN) antes da
 * capital da Paraíba.
 *
 * @example
 * searchMatchRank("joaopessoa", ["joaopessoa", "joaopessoa-pb"]); // 0
 * searchMatchRank("joaopessoa", ["coroneljoaopessoa"]); // 2
 */
export function searchMatchRank(
  query: string,
  texts: readonly (string | undefined)[],
): 0 | 1 | 2 | null {
  let rank: 0 | 1 | 2 | null = null;

  for (const text of texts) {
    if (!text) continue;
    if (text === query) return 0;
    if (text.startsWith(query)) rank = 1;
    else if (rank === null && text.includes(query)) rank = 2;
  }

  return rank;
}
