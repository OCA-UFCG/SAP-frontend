import { STATE_KEY_PATTERN } from "@/utils/geeStateCode";

/** Código IBGE de 7 dígitos, a chave territorial de um município. */
export const MUNICIPALITY_KEY_PATTERN = /^\d{7}$/u;

/**
 * Se uma linha lida do Earth Engine entra na resposta de um território.
 *
 * `br` carrega também as 27 UFs, porque é do recorte nacional que sai o ranking
 * de estados do painel. Qualquer outro recorte leva só a própria linha.
 *
 * A regra mora aqui, e não em cada repositório, porque as duas formas de tabela
 * estatística — a distribuição por classes e o valor único por município —
 * precisam responder o mesmo conjunto de territórios. Duas cópias divergiriam
 * sem ninguém notar: nenhuma das duas falha, uma só passa a devolver
 * territórios diferentes da outra.
 *
 * @example
 * shouldIncludeLocation("br", "pb"); // true — o ranking nacional precisa da UF
 * shouldIncludeLocation("pb", "2507507"); // false
 */
export function shouldIncludeLocation(
  requestedLocationKey: string,
  rowKey: string,
): boolean {
  return requestedLocationKey === "br"
    ? rowKey === "br" || STATE_KEY_PATTERN.test(rowKey)
    : requestedLocationKey === rowKey;
}
