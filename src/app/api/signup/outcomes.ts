/**
 * Quantas respostas o cadastro deu, por status, para o `/api/metrics`.
 *
 * A recusa por origem (403) já deixou o cadastro inteiro fora do ar sem
 * ninguém saber, e um 500 é o cadastro quebrado: os dois só apareciam no log
 * do nginx. Os status de sempre começam em zero para a série existir antes do
 * primeiro pedido.
 *
 * No `globalThis` pelo mesmo motivo do contador do Contentful: o Next empacota
 * cada rota à parte, e quem conta e quem publica precisam ver o mesmo número.
 */
const counts = ((globalThis as { __sedesSignupResponses?: Map<number, number> })
  .__sedesSignupResponses ??= new Map(
  [201, 400, 403, 429, 500].map((status) => [status, 0]),
));

export function countSignupResponse(status: number) {
  counts.set(status, (counts.get(status) ?? 0) + 1);
}

export function getSignupResponseCounts(): ReadonlyMap<number, number> {
  return counts;
}
