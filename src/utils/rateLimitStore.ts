interface RateLimitWindow {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  /** A janela ainda válida dessa chave, ou null quando ela já expirou. */
  get(clientKey: string, now: number): RateLimitWindow | null;
  set(clientKey: string, window: RateLimitWindow, now: number): void;
  clear(): void;
  /** Quantas janelas o mapa guarda. Existe para a varredura ser verificável. */
  size(): number;
}

// A varredura custa O(n), então não vale rodar a cada requisição. O gatilho é
// alto o bastante para o custo se diluir e baixo o bastante para o mapa nunca
// virar um vazamento: com janelas de um minuto, tudo o que passou do `resetAt`
// já é lixo.
const SWEEP_THRESHOLD = 1000;

/**
 * Guarda as janelas de um limitador de taxa por chave de cliente, descartando
 * as expiradas em vez de acumulá-las para sempre.
 *
 * Diferente dos caches do projeto, aqui não há evicção por uso: toda entrada
 * tem prazo de validade curto, então basta varrer as vencidas.
 *
 * const store = createRateLimitStore();
 * const current = store.get(userId, Date.now());
 */
export function createRateLimitStore(): RateLimitStore {
  const windowsByClient = new Map<string, RateLimitWindow>();

  function dropExpired(now: number) {
    for (const [clientKey, window] of windowsByClient) {
      if (now >= window.resetAt) {
        windowsByClient.delete(clientKey);
      }
    }
  }

  return {
    get(clientKey, now) {
      const window = windowsByClient.get(clientKey);

      if (!window || now >= window.resetAt) {
        return null;
      }

      return window;
    },
    set(clientKey, window, now) {
      if (windowsByClient.size >= SWEEP_THRESHOLD) {
        dropExpired(now);
      }

      windowsByClient.set(clientKey, window);
    },
    clear() {
      windowsByClient.clear();
    },
    size() {
      return windowsByClient.size;
    },
  };
}

export interface RateLimitDecision {
  /** Quantas unidades do custo pedido couberam na janela. */
  granted: number;
  limited: boolean;
  headers: Record<string, string>;
  retryAfterSeconds: number;
}

/**
 * O limitador de janela fixa por cliente de todas as rotas: Earth Engine,
 * AMFE, logs e cadastro mudam só a janela, o teto e quanto cada requisição
 * custa. O teto vem em cada consumo porque os logs usam dois na mesma janela
 * (autenticado e anônimo).
 *
 * A reserva é parcial: com 25 de 30 vagas usadas, um custo de 10 concede 5 e
 * sai `limited`. Para quem cobra uma vaga por requisição, ou barra o lote
 * inteiro quando vem `limited`, isso decide igual a um contador que só soma —
 * `limited` sai verdadeiro exatamente quando usado + custo passa do teto, e
 * depois disso a janela fica cheia até vencer nos dois jeitos.
 *
 * const limiter = createRateLimiter({ windowMs: 60_000 });
 * const { limited, headers } = limiter.consume(userId, 30);
 */
export function createRateLimiter({ windowMs }: { windowMs: number }) {
  const store = createRateLimitStore();

  return {
    consume(
      clientKey: string,
      maxRequests: number,
      cost = 1,
    ): RateLimitDecision {
      const now = Date.now();
      const current = store.get(clientKey, now);
      const used = current?.count ?? 0;
      const resetAt = current?.resetAt ?? now + windowMs;
      const granted = Math.max(0, Math.min(cost, maxRequests - used));

      store.set(clientKey, { count: used + granted, resetAt }, now);

      return {
        granted,
        limited: granted < cost,
        headers: {
          "X-RateLimit-Limit": String(maxRequests),
          "X-RateLimit-Remaining": String(
            Math.max(0, maxRequests - used - granted),
          ),
          "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
        },
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
      };
    },
    clear() {
      store.clear();
    },
  };
}

/**
 * Endereço do cliente para a chave do limitador, ou `undefined` quando nenhum
 * proxy repassou um. Do `x-forwarded-for` vale o primeiro da cadeia, depois
 * `x-real-ip` e `cf-connecting-ip`. O que fazer sem endereço fica com quem
 * chama: os logs caem para o user-agent calados, o cadastro avisa no log.
 */
export function getClientAddress(request: Request) {
  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const connectingIp = request.headers.get("cf-connecting-ip")?.trim();

  return forwardedFor || realIp || connectingIp || undefined;
}

export { SWEEP_THRESHOLD as RATE_LIMIT_STORE_SWEEP_THRESHOLD };
