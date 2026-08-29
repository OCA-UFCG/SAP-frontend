import { describe, expect, it } from "vitest";

import { createRateLimiter } from "@/app/api/rateLimit";

function buildLimiter(maxRequests: number, windowMs = 60_000) {
  return createRateLimiter({ windowMs, getMaxRequests: () => maxRequests });
}

describe("contador de requisições por janela", () => {
  it("libera até o teto e barra a partir dele", () => {
    const limiter = buildLimiter(2);

    expect(limiter.consume("user-1").limited).toBe(false);
    expect(limiter.consume("user-1").limited).toBe(false);
    expect(limiter.consume("user-1").limited).toBe(true);
  });

  it("conta cada cliente na sua própria janela", () => {
    const limiter = buildLimiter(1);

    limiter.consume("user-1");

    expect(limiter.consume("user-1").limited).toBe(true);
    expect(limiter.consume("user-2").limited).toBe(false);
  });

  it("informa o teto, o que sobrou e quando recomeça", () => {
    const limiter = buildLimiter(3);

    const decision = limiter.consume("user-1");

    expect(decision.headers["X-RateLimit-Limit"]).toBe("3");
    expect(decision.headers["X-RateLimit-Remaining"]).toBe("2");
    expect(Number(decision.headers["X-RateLimit-Reset"])).toBeGreaterThan(
      Math.floor(Date.now() / 1000) - 1,
    );
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("recomeça a contagem quando a janela vence", async () => {
    const limiter = buildLimiter(1, 10);

    expect(limiter.consume("user-1").limited).toBe(false);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(limiter.consume("user-1").limited).toBe(false);
  });

  // O teto é lido a cada consumo justamente para poder vir do ambiente.
  it("respeita um teto que muda entre chamadas", () => {
    let maxRequests = 1;
    const limiter = createRateLimiter({
      windowMs: 60_000,
      getMaxRequests: () => maxRequests,
    });

    limiter.consume("user-1");
    maxRequests = 5;

    expect(limiter.consume("user-1").limited).toBe(false);
  });

  it("esquece o cliente depois de um clear", () => {
    const limiter = buildLimiter(1);

    limiter.consume("user-1");
    limiter.clear();

    expect(limiter.consume("user-1").limited).toBe(false);
  });
});
