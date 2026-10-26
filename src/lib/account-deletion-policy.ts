import type { AccessClaim } from "@/lib/access-claims";

/**
 * Quem pode excluir a própria conta sem passar pela equipe: só quem veio do
 * cadastro, porque essa conta é de uma pessoa só.
 *
 * As contas de antes do cadastro (`legacy`) foram criadas à mão, e algumas são
 * divididas entre várias pessoas de outros órgãos. Apagar uma delas tiraria o
 * acesso de todo mundo que a usa, então o pedido vai para a equipe.
 *
 * Fica fora da rota para a página poder decidir o que mostrar com a mesma regra.
 */
export function canDeleteOwnAccount(access: AccessClaim | null) {
  return access?.tier === "allowed" || access?.tier === "common";
}
