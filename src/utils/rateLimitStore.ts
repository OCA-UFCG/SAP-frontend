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

export { SWEEP_THRESHOLD as RATE_LIMIT_STORE_SWEEP_THRESHOLD };
