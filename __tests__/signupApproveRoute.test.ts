import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireCatalogAccessMock,
  approveAccessMock,
  readAccessRequestMock,
  claimPendingDecisionMock,
  updateUserMock,
  sendMailMock,
} = vi.hoisted(() => ({
  requireCatalogAccessMock: vi.fn(),
  approveAccessMock: vi.fn(),
  readAccessRequestMock: vi.fn(),
  claimPendingDecisionMock: vi.fn(),
  updateUserMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { updateUser: updateUserMock },
  adminDb: {},
}));

vi.mock("@/app/api/index-catalog/http", () => ({
  requireCatalogAccess: requireCatalogAccessMock,
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
    claimPendingDecision: claimPendingDecisionMock,
  };
});

vi.mock("@/lib/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mailer")>();
  return { ...actual, sendMail: sendMailMock };
});

import { POST as approve } from "@/app/api/signup/approve/route";

const ORIGIN = "https://sap.example";
const OPERATOR = { uid: "admin-1", email: "operador@lsd.ufcg.edu.br", access: null };

function buildRequest(body: unknown) {
  return new Request(`${ORIGIN}/api/signup/approve`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      origin: ORIGIN,
      "sec-fetch-site": "same-origin",
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
    notifiedAt: "2026-09-25T01:00:00.000Z",
    ...overrides,
  };
}

describe("POST /api/signup/approve", () => {
  beforeEach(() => {
    requireCatalogAccessMock.mockReset().mockResolvedValue({ user: OPERATOR });
    approveAccessMock.mockReset().mockResolvedValue(undefined);
    readAccessRequestMock.mockReset().mockResolvedValue(pendingRequest());
    claimPendingDecisionMock
      .mockReset()
      .mockResolvedValue({ claimed: true, tier: "common" });
    updateUserMock.mockReset().mockResolvedValue(undefined);
    sendMailMock.mockReset().mockResolvedValue({ delivered: true });
    vi.unstubAllEnvs();
    vi.stubEnv("NEXT_PUBLIC_HOST_URL", ORIGIN);
  });

  // Aprovar acesso é mais sensível que publicar um índice, então usa o mesmo
  // guard do catálogo — o mais estrito do projeto — e como mutação.
  it("goes through the catalog-grade protection, as a mutation", async () => {
    await approve(buildRequest({ uid: "user-123", decision: "approved" }));

    expect(requireCatalogAccessMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ mutation: true }),
    );
  });

  it("refuses when that protection refuses", async () => {
    requireCatalogAccessMock.mockResolvedValue({
      response: new Response(null, { status: 403 }),
    });

    const response = await approve(
      buildRequest({ uid: "user-123", decision: "approved" }),
    );

    expect(response.status).toBe(403);
    expect(approveAccessMock).not.toHaveBeenCalled();
  });

  it("grants the claim using the tier the signup recorded", async () => {
    await approve(buildRequest({ uid: "user-123", decision: "approved" }));

    expect(approveAccessMock).toHaveBeenCalledWith("user-123", "common");
  });

  // "quem decidiu e quando" é metade do valor da trilha de auditoria.
  it("records which operator decided", async () => {
    await approve(buildRequest({ uid: "user-123", decision: "approved" }));

    expect(claimPendingDecisionMock).toHaveBeenCalledWith("user-123", {
      status: "approved",
      decidedBy: "operador@lsd.ufcg.edu.br",
    });
  });

  it("tells the person their access is open", async () => {
    await approve(buildRequest({ uid: "user-123", decision: "approved" }));

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "fulano@gmail.com" }),
    );
  });

  // Sem desabilitar, quem foi recusado mantém conta ativa e fica tentando
  // entrar para sempre — e o e-mail dele continua ocupado, então nem um novo
  // cadastro resolve.
  it("disables the account of someone who was refused", async () => {
    await approve(buildRequest({ uid: "user-123", decision: "rejected" }));

    expect(updateUserMock).toHaveBeenCalledWith("user-123", { disabled: true });
  });

  it("leaves an approved account enabled", async () => {
    await approve(buildRequest({ uid: "user-123", decision: "approved" }));

    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it("records a rejection without granting anything", async () => {
    await approve(buildRequest({ uid: "user-123", decision: "rejected" }));

    expect(approveAccessMock).not.toHaveBeenCalled();
    expect(claimPendingDecisionMock).toHaveBeenCalledWith("user-123", {
      status: "rejected",
      decidedBy: "operador@lsd.ufcg.edu.br",
    });
  });

  // A equipe ainda não decidiu se avisa quem foi recusado, então o padrão é
  // não avisar e a escolha fica numa variável de ambiente.
  it("stays silent on a rejection unless the team turned that on", async () => {
    await approve(buildRequest({ uid: "user-123", decision: "rejected" }));

    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("tells a rejected person once the team turns that on", async () => {
    vi.stubEnv("SIGNUP_SEND_REJECTION_EMAIL", "true");

    await approve(buildRequest({ uid: "user-123", decision: "rejected" }));

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "fulano@gmail.com" }),
    );
  });

  // Quem chega em segundo não toma a decisão: a transação recusa, e a rota
  // devolve conflito em vez de sobrescrever o que o primeiro decidiu.
  it("refuses the operator who arrived second", async () => {
    claimPendingDecisionMock.mockResolvedValue({
      claimed: false,
      status: "approved",
    });

    const response = await approve(
      buildRequest({ uid: "user-123", decision: "rejected" }),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ status: "approved" }),
    );
    expect(approveAccessMock).not.toHaveBeenCalled();
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  // O tier vem do que a transação leu do cadastro, nunca do que a tela mandou.
  it("grants the tier the transaction read, not one the screen could send", async () => {
    claimPendingDecisionMock.mockResolvedValue({
      claimed: true,
      tier: "allowed",
    });

    await approve(
      buildRequest({ uid: "user-123", decision: "approved", tier: "legacy" }),
    );

    expect(approveAccessMock).toHaveBeenCalledWith("user-123", "allowed");
  });

  it("refuses an unknown decision", async () => {
    const response = await approve(
      buildRequest({ uid: "user-123", decision: "talvez" }),
    );

    expect(response.status).toBe(400);
    expect(approveAccessMock).not.toHaveBeenCalled();
  });
});
