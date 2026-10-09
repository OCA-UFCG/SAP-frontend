import { createRateLimiter } from "@/utils/rateLimitStore";

const EE_RATE_LIMIT_WINDOW_MS = 1000 * 60;
const EE_RATE_LIMIT_MAX_REQUESTS = 30;
/**
 * Miniaturas do relatório por minuto, por usuário: ~6 relatórios de territórios
 * novos. Elas têm cota própria porque, ao contrário da URL de tiles, a miniatura
 * é de um recorte só e quase nunca está em cache — na cota do mapa, o segundo
 * relatório do minuto já saía com mapas faltando.
 */
const EE_THUMBNAIL_RATE_LIMIT_MAX_REQUESTS = 120;

const eeRateLimiter = createRateLimiter({ windowMs: EE_RATE_LIMIT_WINDOW_MS });
const eeThumbnailRateLimiter = createRateLimiter({
  windowMs: EE_RATE_LIMIT_WINDOW_MS,
});

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
  return eeRateLimiter.consume(clientKey, EE_RATE_LIMIT_MAX_REQUESTS, cost);
}

/** Mesma reserva parcial de `consumeEeRateLimit`, na cota das miniaturas. */
export function consumeEeThumbnailRateLimit(clientKey: string, cost = 1) {
  return eeThumbnailRateLimiter.consume(
    clientKey,
    EE_THUMBNAIL_RATE_LIMIT_MAX_REQUESTS,
    cost,
  );
}

export function clearEeRateLimit() {
  eeRateLimiter.clear();
  eeThumbnailRateLimiter.clear();
}

export {
  EE_RATE_LIMIT_MAX_REQUESTS,
  EE_RATE_LIMIT_WINDOW_MS,
  EE_THUMBNAIL_RATE_LIMIT_MAX_REQUESTS,
};
