import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createUserMock,
  setCustomUserClaimsMock,
  createAccessRequestMock,
  deleteUserMock,
  generateEmailVerificationLinkMock,
  sendMailMock,
} = vi.hoisted(() => ({
  createUserMock: vi.fn(),
  setCustomUserClaimsMock: vi.fn(),
  createAccessRequestMock: vi.fn(),
  deleteUserMock: vi.fn(),
  generateEmailVerificationLinkMock: vi.fn(),
  sendMailMock: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    createUser: createUserMock,
    deleteUser: deleteUserMock,
    setCustomUserClaims: setCustomUserClaimsMock,
    generateEmailVerificationLink: generateEmailVerificationLinkMock,
  },
  adminDb: {},
}));

vi.mock("@/lib/mailer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/mailer")>();

  return { ...actual, sendMail: sendMailMock };
});

vi.mock("@/lib/access-requests", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/access-requests")>();

  return { ...actual, createAccessRequest: createAccessRequestMock };
});

import { POST as signup } from "@/app/api/signup/route";
import {
  SIGNUP_RATE_LIMIT_MAX_REQUESTS,
  clearSignupRateLimits,
} from "@/app/api/signup/rate-limit";

const ORIGIN = "https://sap.example";
const VALID_PASSWORD = "uma-senha-forte-123";

function buildRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/signup`, {
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

function firebaseError(code: string) {
  return Object.assign(new Error(code), { code });
}

describe("POST /api/signup", () => {
  beforeEach(() => {
    clearSignupRateLimits();
    createUserMock.mockReset().mockResolvedValue({ uid: "user-123" });
    setCustomUserClaimsMock.mockReset().mockResolvedValue(undefined);
    createAccessRequestMock.mockReset().mockResolvedValue(undefined);
    deleteUserMock.mockReset().mockResolvedValue(undefined);
    generateEmailVerificationLinkMock
      .mockReset()
      .mockResolvedValue("https://sap.example/verificar?oobCode=abc");
    sendMailMock.mockReset().mockResolvedValue({ delivered: true });
    vi.unstubAllEnvs();
    vi.stubEnv("SIGNUP_ALLOWED_DOMAINS", "ufcg.edu.br");
    vi.stubEnv("NEXT_PUBLIC_HOST_URL", ORIGIN);
  });

  it("sends the verification email to the address that signed up", async () => {
    await signup(
      buildRequest({
        email: "fulano@ufcg.edu.br",
        password: VALID_PASSWORD,
        intention: "Pesquisa sobre seca",
      }),
    );

    expect(generateEmailVerificationLinkMock).toHaveBeenCalledWith(
      "fulano@ufcg.edu.br",
      expect.objectContaining({
        url: `${ORIGIN}/cadastro/confirmacao?email=fulano%40ufcg.edu.br`,
      }),
    );
    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "fulano@ufcg.edu.br" }),
    );
  });

  // O pedido já está registrado quando o envio acontece. Derrubar o cadastro
  // por causa do servidor de e-mail perderia o registro de alguém que fez tudo
  // certo — e existe o "reenviar e-mail" para o caso.
  it("does not lose the signup when the email fails to go out", async () => {
    sendMailMock.mockRejectedValue(new Error("smtp fora do ar"));

    const response = await signup(
      buildRequest({
        email: "fulano@ufcg.edu.br",
        password: VALID_PASSWORD,
        intention: "Pesquisa sobre seca",
      }),
    );

    expect(response.status).toBe(201);
    expect(createAccessRequestMock).toHaveBeenCalled();
  });

  it("creates the account for an allowed domain without asking for an intention", async () => {
    const response = await signup(
      buildRequest({
        email: "fulano@ufcg.edu.br",
        password: VALID_PASSWORD,
        intention: "Pesquisa sobre seca",
      }),
    );

    expect(response.status).toBe(201);
    expect(createUserMock).toHaveBeenCalledWith({
      email: "fulano@ufcg.edu.br",
      password: VALID_PASSWORD,
      emailVerified: false,
    });
  });

  // A trilha de auditoria é por pedido, não por trilho: quem entra por domínio
  // também deixa rastro de quando pediu.
  it("opens an access request for the institutional trail too", async () => {
    await signup(
      buildRequest({
        email: "fulano@ufcg.edu.br",
        password: VALID_PASSWORD,
        intention: "Pesquisa sobre seca",
      }),
    );

    expect(createAccessRequestMock).toHaveBeenCalledWith("user-123", {
      email: "fulano@ufcg.edu.br",
      tier: "allowed",
      intention: "Pesquisa sobre seca",
      locale: "pt",
    });
  });

  it("stores the intention for a domain that needs manual approval", async () => {
    await signup(
      buildRequest({
        email: "fulano@gmail.com",
        password: VALID_PASSWORD,
        intention: "  Pesquisa   sobre seca  ",
      }),
    );

    expect(createAccessRequestMock).toHaveBeenCalledWith("user-123", {
      email: "fulano@gmail.com",
      tier: "common",
      intention: "Pesquisa sobre seca",
      locale: "pt",
    });
  });

  // A intenção é pedida a todo mundo, inclusive a quem entra por domínio
  // autorizado: ela é parte da trilha de auditoria, não só um insumo da decisão
  // manual.
  it("refuses a signup that did not describe an intention", async () => {
    const response = await signup(
      buildRequest({ email: "fulano@ufcg.edu.br", password: VALID_PASSWORD }),
    );

    expect(response.status).toBe(400);
    expect(createUserMock).not.toHaveBeenCalled();
  });

  // Se as duas respostas diferissem, bastaria enviar o formulário para
  // descobrir a allowlist inteira, que é o que a rota domain-check contém.
  it("answers identically for both trails", async () => {
    const allowed = await signup(
      buildRequest({
        email: "fulano@ufcg.edu.br",
        password: VALID_PASSWORD,
        intention: "Pesquisa sobre seca",
      }),
    );
    const common = await signup(
      buildRequest({
        email: "fulano@gmail.com",
        password: VALID_PASSWORD,
        intention: "Pesquisa sobre seca",
      }),
    );

    expect(common.status).toBe(allowed.status);
    await expect(common.json()).resolves.toEqual(await allowed.json());
  });

  // Contar que o e-mail já existe transforma o cadastro num oráculo de quem tem
  // conta na plataforma.
  it("hides that an email already has an account", async () => {
    const fresh = await signup(
      buildRequest({ email: "novo@ufcg.edu.br", password: VALID_PASSWORD }),
    );
    const freshBody = await fresh.json();

    createUserMock.mockRejectedValue(firebaseError("auth/email-already-exists"));

    const repeated = await signup(
      buildRequest({ email: "existente@ufcg.edu.br", password: VALID_PASSWORD }),
    );

    expect(repeated.status).toBe(fresh.status);
    await expect(repeated.json()).resolves.toEqual(freshBody);
  });

  it("refuses a malformed email", async () => {
    const response = await signup(
      buildRequest({ email: "isso-nao-e-email", password: VALID_PASSWORD }),
    );

    expect(response.status).toBe(400);
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("refuses a password below the minimum length", async () => {
    const response = await signup(
      buildRequest({ email: "fulano@ufcg.edu.br", password: "curta" }),
    );

    expect(response.status).toBe(400);
    expect(createUserMock).not.toHaveBeenCalled();
  });

  // Fase 3 entrega a conta, não a entrada: o claim só é gravado depois da
  // confirmação de e-mail, na fase 4.
  it("never grants access at signup time", async () => {
    await signup(
      buildRequest({
        email: "fulano@ufcg.edu.br",
        password: VALID_PASSWORD,
        intention: "Pesquisa sobre seca",
      }),
    );

    expect(setCustomUserClaimsMock).not.toHaveBeenCalled();
  });

  // Sem desfazer, a conta fica órfã: a pessoa tenta de novo, recebe o sucesso
  // genérico de "e-mail já existe", e nunca mais consegue abrir um pedido nem
  // receber e-mail. Fica presa vendo telas de sucesso.
  it("undoes the account when the access request cannot be stored", async () => {
    createAccessRequestMock.mockRejectedValue(new Error("firestore fora do ar"));

    const response = await signup(
      buildRequest({
        email: "fulano@ufcg.edu.br",
        password: VALID_PASSWORD,
        intention: "Pesquisa sobre seca",
      }),
    );

    expect(deleteUserMock).toHaveBeenCalledWith("user-123");
    expect(response.status).toBe(500);
  });

  it("still answers an error when undoing the account also fails", async () => {
    createAccessRequestMock.mockRejectedValue(new Error("firestore fora do ar"));
    deleteUserMock.mockRejectedValue(new Error("nem apagar deu"));

    const response = await signup(
      buildRequest({
        email: "fulano@ufcg.edu.br",
        password: VALID_PASSWORD,
        intention: "Pesquisa sobre seca",
      }),
    );

    expect(response.status).toBe(500);
  });

  it("refuses a request from an untrusted origin", async () => {
    const response = await signup(
      buildRequest(
        { email: "fulano@ufcg.edu.br", password: VALID_PASSWORD },
        { origin: "https://atacante.example", "sec-fetch-site": "cross-site" },
      ),
    );

    expect(response.status).toBe(403);
    expect(createUserMock).not.toHaveBeenCalled();
  });

  it("rate limits a client that floods the signup", async () => {
    for (let attempt = 0; attempt < SIGNUP_RATE_LIMIT_MAX_REQUESTS; attempt += 1) {
      const allowed = await signup(
        buildRequest({
          email: `pessoa${attempt}@ufcg.edu.br`,
          password: VALID_PASSWORD,
          intention: "Pesquisa sobre seca",
        }),
      );
      expect(allowed.status).toBe(201);
    }

    const blocked = await signup(
      buildRequest({
        email: "maisum@ufcg.edu.br",
        password: VALID_PASSWORD,
        intention: "Pesquisa sobre seca",
      }),
    );

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });
});
