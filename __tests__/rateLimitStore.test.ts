import { describe, expect, it } from "vitest";
import {
  createRateLimitStore,
  RATE_LIMIT_STORE_SWEEP_THRESHOLD,
} from "@/utils/rateLimitStore";

describe("createRateLimitStore", () => {
  it("devolve null para uma chave que nunca foi usada", () => {
    const store = createRateLimitStore();

    expect(store.get("uid-1", 1_000)).toBeNull();
  });

  it("devolve a janela enquanto ela não venceu", () => {
    const store = createRateLimitStore();
    store.set("uid-1", { count: 3, resetAt: 60_000 }, 0);

    expect(store.get("uid-1", 59_999)).toEqual({ count: 3, resetAt: 60_000 });
  });

  it("trata uma janela vencida como ausente", () => {
    const store = createRateLimitStore();
    store.set("uid-1", { count: 3, resetAt: 60_000 }, 0);

    expect(store.get("uid-1", 60_000)).toBeNull();
  });

  it("esquece tudo em clear", () => {
    const store = createRateLimitStore();
    store.set("uid-1", { count: 1, resetAt: 60_000 }, 0);

    store.clear();

    expect(store.get("uid-1", 0)).toBeNull();
    expect(store.size()).toBe(0);
  });

  // Regressão: antes deste armazenamento os três limitadores guardavam as
  // janelas num Map que nunca era limpo, então o mapa crescia com uma entrada
  // por usuário já atendido e nunca encolhia.
  it("descarta as janelas vencidas quando passa do gatilho de varredura", () => {
    const store = createRateLimitStore();

    for (let index = 0; index < RATE_LIMIT_STORE_SWEEP_THRESHOLD; index += 1) {
      store.set(`uid-${index}`, { count: 1, resetAt: 60_000 }, 0);
    }

    expect(store.size()).toBe(RATE_LIMIT_STORE_SWEEP_THRESHOLD);

    store.set("uid-atrasado", { count: 1, resetAt: 120_000 }, 60_000);

    expect(store.size()).toBe(1);
    expect(store.get("uid-atrasado", 60_000)).toEqual({
      count: 1,
      resetAt: 120_000,
    });
  });

  it("mantém as janelas ainda válidas durante a varredura", () => {
    const store = createRateLimitStore();

    for (let index = 0; index < RATE_LIMIT_STORE_SWEEP_THRESHOLD; index += 1) {
      store.set(`uid-${index}`, { count: 1, resetAt: 120_000 }, 0);
    }

    store.set("uid-novo", { count: 1, resetAt: 120_000 }, 60_000);

    expect(store.size()).toBe(RATE_LIMIT_STORE_SWEEP_THRESHOLD + 1);
  });
});
