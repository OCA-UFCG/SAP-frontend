import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  sendPasswordResetEmailMock,
  checkCodeMock,
  resetMock,
  getUserByEmailMock,
  revokeMock,
  afterTasks,
} = vi.hoisted(() => ({
  sendPasswordResetEmailMock: vi.fn(),
  checkCodeMock: vi.fn(),
  resetMock: vi.fn(),
  getUserByEmailMock: vi.fn(),
  revokeMock: vi.fn(),
  afterTasks: [] as Promise<unknown>[],
}));

// Fora de uma requisição de verdade, o `after` do Next lança. Aqui ele roda a
// tarefa e guarda a promessa, para o teste esperar o envio que ficou para depois.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (task: () => unknown) => {
      afterTasks.push(Promise.resolve().then(task));
    },
  };
});

vi.mock("@/lib/password-reset", () => ({
  sendPasswordResetEmail: sendPasswordResetEmailMock,
}));

vi.mock("@/lib/password-reset-code", () => ({
  checkPasswordResetCode: checkCodeMock,
  resetPasswordWithCode: resetMock,
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    getUserByEmail: getUserByEmailMock,
    revokeRefreshTokens: revokeMock,
  },
  adminDb: {},
}));

import { POST as requestReset } from "@/app/api/password-reset/route";
import { POST as checkCode } from "@/app/api/password-reset/check/route";
import { POST as confirmReset } from "@/app/api/password-reset/confirm/route";
import {
  PASSWORD_RESET_CODE_RATE_LIMIT_MAX_REQUESTS,
  PASSWORD_RESET_REQUEST_RATE_LIMIT_MAX_REQUESTS,
  clearSignupRateLimits,
} from "@/app/api/signup/rate-limit";

const ORIGIN = "https://sap.example";

function buildRequest(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(`${ORIGIN}${path}`, {
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

const UNTRUSTED = {
  origin: "https://atacante.example",
  "sec-fetch-site": "cross-site",
};

async function settled() {
  await Promise.all(afterTasks.splice(0));
}

beforeEach(() => {
  clearSignupRateLimits();
  afterTasks.splice(0);
  sendPasswordResetEmailMock.mockReset().mockResolvedValue(true);
  checkCodeMock.mockReset().mockResolvedValue("fulano@ufcg.edu.br");
  resetMock
    .mockReset()
    .mockResolvedValue({ status: "changed", email: "fulano@ufcg.edu.br" });
  getUserByEmailMock.mockReset().mockResolvedValue({ uid: "user-123" });
  revokeMock.mockReset().mockResolvedValue(undefined);
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_HOST_URL", ORIGIN);
  vi.restoreAllMocks();
});

describe("POST /api/password-reset", () => {
  const PATH = "/api/password-reset";

  it("sends the reset link in the language of the page", async () => {
    const response = await requestReset(
      buildRequest(PATH, { email: " Fulano@UFCG.edu.br ", locale: "en" }),
    );
    await settled();

    expect(response.status).toBe(202);
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(
      "fulano@ufcg.edu.br",
      "en",
    );
  });

  it("falls back to Portuguese for a language the site does not have", async () => {
    await requestReset(
      buildRequest(PATH, { email: "fulano@ufcg.edu.br", locale: "fr" }),
    );
    await settled();

    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(
      "fulano@ufcg.edu.br",
      "pt",
    );
  });

  // Trocar a senha não cria conta: a porta fica aberta mesmo com o bloqueio de
  // acesso desligado, ao contrário do cadastro.
  it("works while the access guard is off", async () => {
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "false");

    const response = await requestReset(
      buildRequest(PATH, { email: "fulano@ufcg.edu.br" }),
    );
    await settled();

    expect(response.status).toBe(202);
    expect(sendPasswordResetEmailMock).toHaveBeenCalled();
  });

  // A porta mais óbvia para descobrir quem é usuário da plataforma.
  it("answers the same for an address that has no account", async () => {
    const known = await requestReset(
      buildRequest(PATH, { email: "fulano@ufcg.edu.br" }),
    );
    const knownBody = await known.json();

    sendPasswordResetEmailMock.mockResolvedValue(false);
    const unknown = await requestReset(
      buildRequest(PATH, { email: "ninguem@gmail.com" }),
    );

    expect(unknown.status).toBe(known.status);
    await expect(unknown.json()).resolves.toEqual(knownBody);
  });

  // O envio fica para depois da resposta: se ela esperasse o SMTP, demoraria
  // mais justo quando a conta existe.
  it("answers before the email goes out", async () => {
    sendPasswordResetEmailMock.mockReturnValue(new Promise(() => undefined));

    const response = await requestReset(
      buildRequest(PATH, { email: "fulano@ufcg.edu.br" }),
    );

    expect(response.status).toBe(202);
  });

  it("sends nothing for an empty body and still answers the same", async () => {
    const response = await requestReset(buildRequest(PATH, {}));
    await settled();

    expect(response.status).toBe(202);
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("refuses a request from an untrusted origin", async () => {
    const response = await requestReset(
      buildRequest(PATH, { email: "fulano@ufcg.edu.br" }, UNTRUSTED),
    );
    await settled();

    expect(response.status).toBe(403);
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("rate limits someone hammering the button", async () => {
    for (
      let attempt = 0;
      attempt < PASSWORD_RESET_REQUEST_RATE_LIMIT_MAX_REQUESTS;
      attempt += 1
    ) {
      await requestReset(
        buildRequest(PATH, { email: `pessoa${attempt}@ufcg.edu.br` }),
      );
    }

    const blocked = await requestReset(
      buildRequest(PATH, { email: "maisum@ufcg.edu.br" }),
    );

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("Retry-After")).toBeTruthy();
  });
});

describe("POST /api/password-reset/check", () => {
  const PATH = "/api/password-reset/check";

  it("tells the page whose password the code changes", async () => {
    const response = await checkCode(buildRequest(PATH, { code: "ABC123" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      email: "fulano@ufcg.edu.br",
    });
    expect(checkCodeMock).toHaveBeenCalledWith("ABC123");
  });

  it("reports an unusable code", async () => {
    checkCodeMock.mockResolvedValue(null);

    const response = await checkCode(buildRequest(PATH, { code: "VENCIDO" }));

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({ reason: "invalid-code" });
  });

  it("does not ask Firebase about a missing code", async () => {
    const response = await checkCode(buildRequest(PATH, {}));

    expect(response.status).toBe(410);
    expect(checkCodeMock).not.toHaveBeenCalled();
  });

  it("refuses a request from an untrusted origin", async () => {
    const response = await checkCode(
      buildRequest(PATH, { code: "ABC123" }, UNTRUSTED),
    );

    expect(response.status).toBe(403);
    expect(checkCodeMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/password-reset/confirm", () => {
  const PATH = "/api/password-reset/confirm";

  it("changes the password and ends the sessions opened with the old one", async () => {
    const response = await confirmReset(
      buildRequest(PATH, { code: "ABC123", password: "senha-nova-1" }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "changed" });
    expect(resetMock).toHaveBeenCalledWith("ABC123", "senha-nova-1");
    expect(getUserByEmailMock).toHaveBeenCalledWith("fulano@ufcg.edu.br");
    expect(revokeMock).toHaveBeenCalledWith("user-123");
  });

  // A senha já mudou; dizer que não mudou faria a pessoa tentar de novo com um
  // código que agora está gasto.
  it("still reports success when the explicit revocation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    revokeMock.mockRejectedValue(new Error("admin fora do ar"));

    const response = await confirmReset(
      buildRequest(PATH, { code: "ABC123", password: "senha-nova-1" }),
    );

    expect(response.status).toBe(200);
  });

  it("refuses a password shorter than the signup allows, before asking Firebase", async () => {
    const response = await confirmReset(
      buildRequest(PATH, { code: "ABC123", password: "curta" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ reason: "weak-password" });
    expect(resetMock).not.toHaveBeenCalled();
  });

  it("passes on a password the Firebase policy refused", async () => {
    resetMock.mockResolvedValue({ status: "weak-password" });

    const response = await confirmReset(
      buildRequest(PATH, { code: "ABC123", password: "senhasemnumero" }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ reason: "weak-password" });
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it("reports an unusable code", async () => {
    resetMock.mockResolvedValue({ status: "invalid-code" });

    const response = await confirmReset(
      buildRequest(PATH, { code: "JA-USADO", password: "senha-nova-1" }),
    );

    expect(response.status).toBe(410);
    await expect(response.json()).resolves.toEqual({ reason: "invalid-code" });
  });

  it("reports a Firebase failure without pretending the code was bad", async () => {
    resetMock.mockResolvedValue({ status: "failed" });

    const response = await confirmReset(
      buildRequest(PATH, { code: "ABC123", password: "senha-nova-1" }),
    );

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ reason: "failed" });
  });

  it("refuses a request from an untrusted origin", async () => {
    const response = await confirmReset(
      buildRequest(
        PATH,
        { code: "ABC123", password: "senha-nova-1" },
        UNTRUSTED,
      ),
    );

    expect(response.status).toBe(403);
    expect(resetMock).not.toHaveBeenCalled();
  });

  // Conferir e trocar dividem o mesmo orçamento: quem abre o link gasta um e
  // envia o formulário gasta outro.
  it("rate limits checking and confirming together", async () => {
    for (
      let attempt = 0;
      attempt < PASSWORD_RESET_CODE_RATE_LIMIT_MAX_REQUESTS;
      attempt += 1
    ) {
      await checkCode(buildRequest("/api/password-reset/check", { code: "X" }));
    }

    const blocked = await confirmReset(
      buildRequest(PATH, { code: "ABC123", password: "senha-nova-1" }),
    );

    expect(blocked.status).toBe(429);
    expect(resetMock).not.toHaveBeenCalled();
  });
});
