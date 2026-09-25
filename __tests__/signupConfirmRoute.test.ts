import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUserByEmailMock,
  approveAccessMock,
  readAccessRequestMock,
  createAccessRequestMock,
  recordAccessDecisionMock,
  claimNotificationMock,
  sendMailMock,
} = vi.hoisted(() => ({
  getUserByEmailMock: vi.fn(),
  approveAccessMock: vi.fn(),
  readAccessRequestMock: vi.fn(),
  createAccessRequestMock: vi.fn(),
  recordAccessDecisionMock: vi.fn(),
  claimNotificationMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { getUserByEmail: getUserByEmailMock },
  adminDb: {},
}));

vi.mock("@/lib/access-claims", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/access-claims")>();
  return { ...actual, approveAccess: approveAccessMock };
});

vi.mock("@/lib/access-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/access-requests")>();
  return {
    ...actual,
    readAccessRequest: readAccessRequestMock,
    createAccessRequest: createAccessRequestMock,
    recordAccessDecision: recordAccessDecisionMock,
    claimTeamNotification: claimNotificationMock,
  };
});

vi.mock("@/lib/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mailer")>();
  return { ...actual, sendMail: sendMailMock };
});

import { POST as confirm } from "@/app/api/signup/confirm/route";
import { clearSignupRateLimits } from "@/app/api/signup/rate-limit";

const ORIGIN = "https://sap.example";

function buildRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/signup/confirm`, {
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

function pendingRequest(overrides = {}) {
  return {
    email: "fulano@gmail.com",
    tier: "common",
    intention: "Pesquisa sobre seca",
    status: "pending",
    createdAt: "2026-09-25T00:00:00.000Z",
    decidedAt: null,
    decidedBy: null,
    notifiedAt: null,
    ...overrides,
  };
}

describe("POST /api/signup/confirm", () => {
  beforeEach(() => {
    clearSignupRateLimits();
    getUserByEmailMock
      .mockReset()
      .mockResolvedValue({ uid: "user-123", emailVerified: true });
    approveAccessMock.mockReset().mockResolvedValue(undefined);
    readAccessRequestMock.mockReset().mockResolvedValue(pendingRequest());
    createAccessRequestMock.mockReset().mockResolvedValue(undefined);
    recordAccessDecisionMock.mockReset().mockResolvedValue(undefined);
    claimNotificationMock.mockReset().mockResolvedValue(true);
    sendMailMock.mockReset().mockResolvedValue({ delivered: true });
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_HOST_URL", ORIGIN);
    vi.stubEnv("OCA_NOTIFICATION_EMAIL", "acesso@lsd.ufcg.edu.br");
  });

  it("grants access to the institutional trail once the address is confirmed", async () => {
    readAccessRequestMock.mockResolvedValue(
      pendingRequest({ tier: "allowed", email: "fulano@ufcg.edu.br", intention: "" }),
    );

    const response = await confirm(
      buildRequest({ email: "fulano@ufcg.edu.br" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "approved" });
    expect(approveAccessMock).toHaveBeenCalledWith("user-123", "allowed");
  });

  // O documento é explícito: a liberação automática vale a regra de domínio,
  // não um operador.
  it("records the automatic approval as decided by the domain rule", async () => {
    readAccessRequestMock.mockResolvedValue(pendingRequest({ tier: "allowed" }));

    await confirm(buildRequest({ email: "fulano@ufcg.edu.br" }));

    expect(recordAccessDecisionMock).toHaveBeenCalledWith("user-123", {
      status: "approved",
      decidedBy: null,
    });
  });

  it("leaves the common trail pending and tells the team", async () => {
    const response = await confirm(buildRequest({ email: "fulano@gmail.com" }));

    await expect(response.json()).resolves.toEqual({ status: "pending" });
    expect(approveAccessMock).not.toHaveBeenCalled();
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "acesso@lsd.ufcg.edu.br" }),
    );
    expect(claimNotificationMock).toHaveBeenCalledWith("user-123");
  });

  // O servidor nunca acredita no navegador: a página de confirmação roda no
  // cliente e pode mentir.
  it("refuses to grant anything while Firebase says the address is unverified", async () => {
    getUserByEmailMock.mockResolvedValue({
      uid: "user-123",
      emailVerified: false,
    });

    const response = await confirm(buildRequest({ email: "fulano@ufcg.edu.br" }));

    expect(response.status).toBe(409);
    expect(approveAccessMock).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  // Quem não ganha a reserva não envia. É o que faz duas aberturas simultâneas
  // do link — duplo clique, ou o programa de e-mail pré-carregando em paralelo
  // com o clique da pessoa — virarem um aviso só.
  it("does not tell the team twice when the link is opened again", async () => {
    claimNotificationMock.mockResolvedValue(false);

    const response = await confirm(buildRequest({ email: "fulano@gmail.com" }));

    await expect(response.json()).resolves.toEqual({ status: "pending" });
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("reports an already approved account without approving it again", async () => {
    readAccessRequestMock.mockResolvedValue(
      pendingRequest({ tier: "allowed", status: "approved" }),
    );

    const response = await confirm(buildRequest({ email: "fulano@ufcg.edu.br" }));

    await expect(response.json()).resolves.toEqual({ status: "approved" });
    expect(approveAccessMock).not.toHaveBeenCalled();
  });

  // Conta existe, e-mail confirmado, e nenhum pedido: é o beco sem saída de
  // quem passou por uma falha no meio do cadastro. Em vez de 409 para sempre, a
  // confirmação abre o pedido que faltou — com o trilho recalculado aqui, nunca
  // vindo do navegador.
  it("opens the missing request instead of trapping the person", async () => {
    readAccessRequestMock.mockResolvedValueOnce(null);
    readAccessRequestMock.mockResolvedValueOnce(
      pendingRequest({ tier: "allowed", email: "fulano@ufcg.edu.br", intention: "" }),
    );
    vi.stubEnv("SIGNUP_ALLOWED_DOMAINS", "ufcg.edu.br");

    const response = await confirm(
      buildRequest({ email: "fulano@ufcg.edu.br" }),
    );

    expect(createAccessRequestMock).toHaveBeenCalledWith("user-123", {
      email: "fulano@ufcg.edu.br",
      tier: "allowed",
      intention: "",
      locale: "pt",
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "approved" });
  });

  it("does not leak whether an address has an account", async () => {
    getUserByEmailMock.mockRejectedValue(
      Object.assign(new Error("not found"), { code: "auth/user-not-found" }),
    );

    const response = await confirm(
      buildRequest({ email: "ninguem@gmail.com" }),
    );

    expect(response.status).toBe(409);
  });

  it("refuses a request from an untrusted origin", async () => {
    const response = await confirm(
      buildRequest(
        { email: "fulano@ufcg.edu.br" },
        { origin: "https://atacante.example", "sec-fetch-site": "cross-site" },
      ),
    );

    expect(response.status).toBe(403);
    expect(approveAccessMock).not.toHaveBeenCalled();
  });
});
