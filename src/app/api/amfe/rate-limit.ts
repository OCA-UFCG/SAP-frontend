import { createRateLimiter } from "@/utils/rateLimitStore";

/**
 * Guarda de taxa da análise multicritério.
 *
 * `/api/amfe/analyze` dispara um cálculo sobre até 5.571 municípios num backend
 * externo — é a rota mais cara do produto, e a sessão sozinha não impede um
 * usuário autenticado de chamá-la num laço. O teto aqui é bem menor que o dos
 * 30/min do Earth Engine (`src/app/api/ee/rate-limit.ts`) justamente porque cada
 * requisição custa muito mais: 5/min ainda é folgado para quem está iterando os
 * pesos no formulário.
 *
 * @example
 *   const rateLimit = consumeAmfeAnalyzeRateLimit(authenticatedUserId);
 *   if (rateLimit.limited) return new Response(null, { status: 429 });
 */
const AMFE_ANALYZE_RATE_LIMIT_WINDOW_MS = 1000 * 60;
const AMFE_ANALYZE_RATE_LIMIT_MAX_REQUESTS = 5;

const amfeAnalyzeRateLimiter = createRateLimiter({
  windowMs: AMFE_ANALYZE_RATE_LIMIT_WINDOW_MS,
});

export function consumeAmfeAnalyzeRateLimit(clientKey: string) {
  return amfeAnalyzeRateLimiter.consume(
    clientKey,
    AMFE_ANALYZE_RATE_LIMIT_MAX_REQUESTS,
  );
}

export function clearAmfeAnalyzeRateLimit() {
  amfeAnalyzeRateLimiter.clear();
}

export {
  AMFE_ANALYZE_RATE_LIMIT_MAX_REQUESTS,
  AMFE_ANALYZE_RATE_LIMIT_WINDOW_MS,
};
