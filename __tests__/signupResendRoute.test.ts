import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateLinkMock, sendMailMock } = vi.hoisted(() => ({
  generateLinkMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { generateEmailVerificationLink: generateLinkMock },
  adminDb: {},
}));

vi.mock("@/lib/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mailer")>();
  return { ...actual, sendMail: sendMailMock };
});

import { POST as resend } from "@/app/api/signup/resend/route";
import {
  RESEND_RATE_LIMIT_MAX_REQUESTS,
  clearSignupRateLimits,
} from "@/app/api/signup/rate-limit";

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
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_HOST_URL", ORIGIN);
  });

  it("sends the verification email again", async () => {
    const response = await resend(buildRequest({ email: "fulano@ufcg.edu.br" }));

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
});
