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

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const requestsByClient = new Map<string, RateLimitEntry>();

export function consumeAmfeAnalyzeRateLimit(clientKey: string) {
  const now = Date.now();
  const currentEntry = requestsByClient.get(clientKey);

  const entry =
    !currentEntry || now >= currentEntry.resetAt
      ? { count: 1, resetAt: now + AMFE_ANALYZE_RATE_LIMIT_WINDOW_MS }
      : { count: currentEntry.count + 1, resetAt: currentEntry.resetAt };

  requestsByClient.set(clientKey, entry);

  return {
    limited: entry.count > AMFE_ANALYZE_RATE_LIMIT_MAX_REQUESTS,
    headers: {
      "X-RateLimit-Limit": String(AMFE_ANALYZE_RATE_LIMIT_MAX_REQUESTS),
      "X-RateLimit-Remaining": String(
        Math.max(0, AMFE_ANALYZE_RATE_LIMIT_MAX_REQUESTS - entry.count),
      ),
      "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
    },
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

export function clearAmfeAnalyzeRateLimit() {
  requestsByClient.clear();
}

export {
  AMFE_ANALYZE_RATE_LIMIT_MAX_REQUESTS,
  AMFE_ANALYZE_RATE_LIMIT_WINDOW_MS,
};
