// Janela fixa por cliente, em memória do processo. Não é um limite global: cada
// instância conta o seu, do mesmo jeito que todos os caches desta base.
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitDecision {
  limited: boolean;
  headers: Record<string, string>;
  retryAfterSeconds: number;
}

export interface RateLimiterOptions {
  windowMs: number;
  /** Lido a cada consumo para o teto poder vir de variável de ambiente. */
  getMaxRequests: () => number;
}

// A partir daqui, um consumo aproveita para descartar as janelas já vencidas.
// Sem isso o mapa guardaria uma entrada por usuário que já passou pelo processo,
// para sempre, e ele só precisa das janelas abertas.
const PRUNE_THRESHOLD = 1000;

/**
 * Contador de requisições por cliente numa janela fixa.
 *
 * @example
 * const limiter = createRateLimiter({ windowMs: 60_000, getMaxRequests: () => 30 });
 * limiter.consume(userId).limited; // false
 */
export function createRateLimiter({
  windowMs,
  getMaxRequests,
}: RateLimiterOptions) {
  const requestsByClient = new Map<string, RateLimitEntry>();

  function pruneExpired(now: number) {
    for (const [clientKey, entry] of requestsByClient) {
      if (now >= entry.resetAt) requestsByClient.delete(clientKey);
    }
  }

  function consume(clientKey: string): RateLimitDecision {
    const now = Date.now();
    const maxRequests = getMaxRequests();

    if (requestsByClient.size >= PRUNE_THRESHOLD) pruneExpired(now);

    const currentEntry = requestsByClient.get(clientKey);
    const entry =
      !currentEntry || now >= currentEntry.resetAt
        ? { count: 1, resetAt: now + windowMs }
        : { count: currentEntry.count + 1, resetAt: currentEntry.resetAt };

    requestsByClient.set(clientKey, entry);

    return {
      limited: entry.count > maxRequests,
      headers: {
        "X-RateLimit-Limit": String(maxRequests),
        "X-RateLimit-Remaining": String(Math.max(0, maxRequests - entry.count)),
        "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
      },
      retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  return { consume, clear: () => requestsByClient.clear() };
}
