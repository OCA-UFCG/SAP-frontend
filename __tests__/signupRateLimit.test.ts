import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONFIRM_RATE_LIMIT_MAX_REQUESTS,
  RESEND_RATE_LIMIT_MAX_REQUESTS,
  SIGNUP_RATE_LIMIT_MAX_REQUESTS,
  clearSignupRateLimits,
  consumeConfirmRateLimit,
  consumeResendRateLimit,
  consumeSignupRateLimit,
  getSignupClientKey,
} from "@/app/api/signup/rate-limit";

function requestWith(headers: Record<string, string>) {
  return new Request("https://sap.example/api/signup", { headers });
}

function exhaust(consume: (key: string) => { limited: boolean }, max: number) {
  for (let attempt = 0; attempt < max; attempt += 1) {
    expect(consume("ip:203.0.113.10").limited).toBe(false);
  }
  return consume("ip:203.0.113.10");
}

describe("signup rate limits", () => {
  beforeEach(() => {
    clearSignupRateLimits();
    vi.restoreAllMocks();
  });

  // O cadastro cria conta E manda e-mail; confirmar só lê. Dividir um balde só
  // entre os três fazia a terceira pessoa de uma mesma repartição ser barrada
  // por causa das duas colegas que se cadastraram antes.
  it("gives each action its own budget", () => {
    expect(exhaust(consumeSignupRateLimit, SIGNUP_RATE_LIMIT_MAX_REQUESTS).limited).toBe(true);

    expect(consumeConfirmRateLimit("ip:203.0.113.10").limited).toBe(false);
    expect(consumeResendRateLimit("ip:203.0.113.10").limited).toBe(false);
  });

  it("keeps a budget that fits a whole office signing up together", () => {
    expect(SIGNUP_RATE_LIMIT_MAX_REQUESTS).toBeGreaterThanOrEqual(20);
    // Confirmar precisa da maior folga: programas de e-mail abrem o link
    // sozinhos para checar segurança, em paralelo com o clique da pessoa.
    expect(CONFIRM_RATE_LIMIT_MAX_REQUESTS).toBeGreaterThan(
      SIGNUP_RATE_LIMIT_MAX_REQUESTS,
    );
    // Reenviar dispara e-mail a cada chamada: é o mais apertado dos três.
    expect(RESEND_RATE_LIMIT_MAX_REQUESTS).toBeLessThan(
      SIGNUP_RATE_LIMIT_MAX_REQUESTS,
    );
  });

  it("counts each client separately", () => {
    exhaust(consumeSignupRateLimit, SIGNUP_RATE_LIMIT_MAX_REQUESTS);

    expect(consumeSignupRateLimit("ip:198.51.100.7").limited).toBe(false);
  });

  describe("quem é o cliente", () => {
    it("prefers the first hop of the forwarded chain", () => {
      expect(
        getSignupClientKey(
          requestWith({
            "x-forwarded-for": "203.0.113.10, 70.41.3.18",
            "x-real-ip": "198.51.100.7",
          }),
        ),
      ).toBe("ip:203.0.113.10");
    });

    it("falls through the other headers the project already reads", () => {
      expect(getSignupClientKey(requestWith({ "x-real-ip": "198.51.100.7" }))).toBe(
        "ip:198.51.100.7",
      );
      expect(
        getSignupClientKey(requestWith({ "cf-connecting-ip": "198.51.100.8" })),
      ).toBe("ip:198.51.100.8");
    });

    // Um balde único para o mundo inteiro é um jeito trivial de derrubar o
    // cadastro: bastaria alguém gastar as tentativas uma vez por minuto.
    it("never puts every visitor in one shared bucket", () => {
      const chrome = getSignupClientKey(requestWith({ "user-agent": "Chrome/120" }));
      const firefox = getSignupClientKey(requestWith({ "user-agent": "Firefox/121" }));

      expect(chrome).not.toBe(firefox);
    });

    // Cair aqui significa que o proxy não está repassando o IP — é problema de
    // infraestrutura, e hoje passava silencioso.
    it("complains loudly when no address header arrives", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

      getSignupClientKey(requestWith({ "user-agent": "Chrome/120" }));

      expect(error).toHaveBeenCalled();
    });

    it("stays quiet when the address is there", () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

      getSignupClientKey(requestWith({ "x-forwarded-for": "203.0.113.10" }));

      expect(error).not.toHaveBeenCalled();
    });
  });
});
