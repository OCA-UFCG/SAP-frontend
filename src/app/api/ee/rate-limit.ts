import { createRateLimitStore } from "@/utils/rateLimitStore";

const EE_RATE_LIMIT_WINDOW_MS = 1000 * 60;
const EE_RATE_LIMIT_MAX_REQUESTS = 30;

const requestsByClient = createRateLimitStore();

/**
 * Reserva vagas da janela do usuário. O custo é o número de idas ao Earth
 * Engine que a requisição vai fazer — uma URL que já está em cache não custa
 * cota nenhuma ao GEE e por isso não custa vaga aqui.
 *
 * Cobrar por requisição, e não por ida ao GEE, era o que derrubava o relatório
 * municipal: 20 camadas viravam 20 requisições contra um teto de 30 por minuto,
 * então quem tivesse acabado de navegar pelo mapa perdia a imagem das últimas
 * camadas do relatório.
 *
 * A reserva é parcial de propósito: com 25 vagas usadas e um pedido de 10, ela
 * concede 5. Quem chama resolve as concedidas e marca o resto como limitado, em
 * vez de derrubar o lote inteiro.
 *
 * @example
 * const { granted } = consumeEeRateLimit(userId, misses.length);
 */
export function consumeEeRateLimit(clientKey: string, cost = 1) {
  const now = Date.now();
  const currentEntry = requestsByClient.get(clientKey, now);
  const used = currentEntry?.count ?? 0;
  const resetAt = currentEntry?.resetAt ?? now + EE_RATE_LIMIT_WINDOW_MS;
  const granted = Math.max(
    0,
    Math.min(cost, EE_RATE_LIMIT_MAX_REQUESTS - used),
  );

  requestsByClient.set(clientKey, { count: used + granted, resetAt }, now);

  return {
    granted,
    limited: granted < cost,
    headers: {
      "X-RateLimit-Limit": String(EE_RATE_LIMIT_MAX_REQUESTS),
      "X-RateLimit-Remaining": String(
        Math.max(0, EE_RATE_LIMIT_MAX_REQUESTS - used - granted),
      ),
      "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
    },
    retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

export function clearEeRateLimit() {
  requestsByClient.clear();
}

export { EE_RATE_LIMIT_MAX_REQUESTS, EE_RATE_LIMIT_WINDOW_MS };
