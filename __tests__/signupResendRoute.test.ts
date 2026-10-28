import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateLinkMock, sendMailMock, verifyCaptchaMock } = vi.hoisted(
  () => ({
    generateLinkMock: vi.fn(),
    sendMailMock: vi.fn(),
    verifyCaptchaMock: vi.fn(),
  }),
);

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { generateEmailVerificationLink: generateLinkMock },
  adminDb: {},
}));

vi.mock("@/lib/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mailer")>();
  return { ...actual, sendMail: sendMailMock };
});

vi.mock("@/lib/captcha", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/captcha")>();

  return { ...actual, verifyCaptcha: verifyCaptchaMock };
});

import { POST as resend } from "@/app/api/signup/resend/route";
import {
  RESEND_RATE_LIMIT_MAX_REQUESTS,
  clearSignupRateLimits,
  consumeVerificationEmailCooldown,
} from "@/app/api/signup/rate-limit";
import { VERIFICATION_EMAIL_COOLDOWN_SECONDS } from "@/config/verificationEmailCooldown";

const ORIGIN = "https://sap.example";

function buildRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/signup/resend`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      origin: ORIGIN,
      "sec-fetch-site": "same-origin",
      "x-forwarded-for": "203.0.113.10",
      ...headers,
    },
  });
}

describe("POST /api/signup/resend", () => {
  beforeEach(() => {
    clearSignupRateLimits();
    generateLinkMock
      .mockReset()
      .mockResolvedValue("https://sap.example/verificar?oobCode=abc");
    sendMailMock.mockReset().mockResolvedValue({ delivered: true });
    verifyCaptchaMock.mockReset().mockResolvedValue(true);
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_HOST_URL", ORIGIN);
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "true");
  });

  it("sends nothing while the access guard is off", async () => {
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "false");

    const response = await resend(
      buildRequest({ email: "fulano@ufcg.edu.br" }),
    );

    expect(response.status).toBe(404);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("sends the verification email again", async () => {
    const response = await resend(
      buildRequest({ email: "fulano@ufcg.edu.br" }),
    );

    expect(response.status).toBe(202);
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "fulano@ufcg.edu.br" }),
    );
  });

  // Reenviar é uma porta aberta para descobrir quem tem conta. A resposta é a
  // mesma para um endereço cadastrado, um desconhecido e um já confirmado.
  it("answers the same for an address that has no account", async () => {
    const known = await resend(buildRequest({ email: "fulano@ufcg.edu.br" }));
    const knownBody = await known.json();

    generateLinkMock.mockRejectedValue(
      Object.assign(new Error("not found"), { code: "auth/user-not-found" }),
    );

    const unknown = await resend(buildRequest({ email: "ninguem@gmail.com" }));

    expect(unknown.status).toBe(known.status);
    await expect(unknown.json()).resolves.toEqual(knownBody);
  });

  it("refuses a request from an untrusted origin", async () => {
    const response = await resend(
      buildRequest(
        { email: "fulano@ufcg.edu.br" },
        { origin: "https://atacante.example", "sec-fetch-site": "cross-site" },
      ),
    );

    expect(response.status).toBe(403);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("rate limits someone hammering the resend button", async () => {
    for (
      let attempt = 0;
      attempt < RESEND_RATE_LIMIT_MAX_REQUESTS;
      attempt += 1
    ) {
      await resend(buildRequest({ email: `pessoa${attempt}@ufcg.edu.br` }));
    }

    const blocked = await resend(buildRequest({ email: "maisum@ufcg.edu.br" }));

    expect(blocked.status).toBe(429);
  });
  it("checks the token for the resend screen, from the visitor address", async () => {
    await resend(
      buildRequest({ email: "fulano@ufcg.edu.br", captchaToken: "token-bom" }),
    );

    expect(verifyCaptchaMock).toHaveBeenCalledWith("token-bom", {
      action: "resend",
      remoteIp: "203.0.113.10",
    });
  });

  // Reenviar manda e-mail para qualquer endereço: é a porta mais fácil para
  // esgotar a cota do Gmail da equipe.
  it("sends nothing when the captcha did not pass", async () => {
    verifyCaptchaMock.mockResolvedValue(false);

    const response = await resend(
      buildRequest({ email: "fulano@ufcg.edu.br", captchaToken: "token-ruim" }),
    );

    expect(response.status).toBe(400);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  // O Firebase recusa o link novo antes de um minuto, e antes a rota respondia
  // "enviado" mesmo assim: a pessoa esperava um e-mail que nunca saía.
  it("asks to wait instead of sending a second email to the same address", async () => {
    await resend(buildRequest({ email: "fulano@ufcg.edu.br" }));
    sendMailMock.mockClear();

    const tooSoon = await resend(
      buildRequest({ email: "Fulano@ufcg.edu.br " }),
    );

    expect(tooSoon.status).toBe(429);
    expect(Number(tooSoon.headers.get("Retry-After"))).toBeGreaterThan(0);
    expect(generateLinkMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  // A espera é do endereço, não da conta: um desconhecido espera igual, e a
  // resposta não diz quem tem cadastro.
  it("asks an address with no account to wait just the same", async () => {
    generateLinkMock.mockRejectedValue(
      Object.assign(new Error("not found"), { code: "auth/user-not-found" }),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    await resend(buildRequest({ email: "ninguem@gmail.com" }));
    const tooSoon = await resend(buildRequest({ email: "ninguem@gmail.com" }));

    expect(tooSoon.status).toBe(429);
  });

  // O cadastro manda o primeiro e-mail; o reenvio logo depois cairia no limite
  // do Firebase.
  it("counts the email the signup just sent", async () => {
    consumeVerificationEmailCooldown("fulano@ufcg.edu.br");

    const tooSoon = await resend(buildRequest({ email: "fulano@ufcg.edu.br" }));

    expect(tooSoon.status).toBe(429);
    expect(generateLinkMock).not.toHaveBeenCalled();
  });

  it("asks to wait when Firebase refused the link anyway", async () => {
    generateLinkMock.mockRejectedValue(
      new Error('Raw server response: "TOO_MANY_ATTEMPTS_TRY_LATER"'),
    );
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await resend(
      buildRequest({ email: "fulano@ufcg.edu.br" }),
    );

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe(
      String(VERIFICATION_EMAIL_COOLDOWN_SECONDS),
    );
  });
});
