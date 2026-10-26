import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUserByEmailMock, readRequestMock, checkPasswordMock, deleteAccountMock } =
  vi.hoisted(() => ({
    getUserByEmailMock: vi.fn(),
    readRequestMock: vi.fn(),
    checkPasswordMock: vi.fn(),
    deleteAccountMock: vi.fn(),
  }));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { getUserByEmail: getUserByEmailMock },
  adminDb: {},
}));

vi.mock("@/lib/access-requests", () => ({
  readAccessRequest: readRequestMock,
}));

vi.mock("@/lib/account-management", () => ({
  checkAccountPassword: checkPasswordMock,
  deleteAccount: deleteAccountMock,
}));

import { POST } from "@/app/api/account/withdraw/route";
import { clearSignupRateLimits } from "@/app/api/signup/rate-limit";

const ORIGIN = "https://sap.example";

function post(body: unknown) {
  return POST(
    new Request(`${ORIGIN}/api/account/withdraw`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        origin: ORIGIN,
        "sec-fetch-site": "same-origin",
        "x-real-ip": "203.0.113.7",
      },
    }),
  );
}

const CREDENTIALS = { email: "fulano@gmail.com", password: "senha-certa" };

describe("POST /api/account/withdraw", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearSignupRateLimits();
    getUserByEmailMock.mockResolvedValue({
      uid: "uid-1",
      email: "fulano@gmail.com",
      disabled: false,
      customClaims: {},
    });
    checkPasswordMock.mockResolvedValue("ok");
    readRequestMock.mockResolvedValue({ status: "pending" });
  });

  it("deletes a pending request once the password checks out", async () => {
    const response = await post(CREDENTIALS);

    expect(response.status).toBe(200);
    expect(checkPasswordMock).toHaveBeenCalledWith(
      "uid-1",
      "fulano@gmail.com",
      "senha-certa",
    );
    expect(deleteAccountMock).toHaveBeenCalledWith("uid-1");
  });

  // A senha vem antes de qualquer coisa sobre a conta: sem ela, a resposta não
  // pode dizer se um e-mail se cadastrou.
  it("answers the same for a wrong password and an unknown email", async () => {
    checkPasswordMock.mockResolvedValueOnce("wrong");
    const wrong = await post(CREDENTIALS);

    getUserByEmailMock.mockRejectedValueOnce(new Error("user-not-found"));
    const unknown = await post(CREDENTIALS);

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    await expect(wrong.json()).resolves.toEqual({ code: "wrong_credentials" });
    await expect(unknown.json()).resolves.toEqual({ code: "wrong_credentials" });
    expect(readRequestMock).not.toHaveBeenCalled();
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  it("does not reveal a rejected (disabled) account", async () => {
    getUserByEmailMock.mockResolvedValueOnce({
      uid: "uid-1",
      email: "fulano@gmail.com",
      disabled: true,
    });

    const response = await post(CREDENTIALS);

    expect(response.status).toBe(401);
    expect(checkPasswordMock).not.toHaveBeenCalled();
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  // Sem pedido nesta coleção, a conta pode ser de outro sistema que divide o
  // projeto do Firebase.
  it("leaves accounts without a pending request to the team", async () => {
    readRequestMock.mockResolvedValueOnce(null);

    const response = await post(CREDENTIALS);

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ code: "ask_team" });
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  // Apagar e se cadastrar de novo devolveria o acesso removido no trilho
  // institucional.
  it("leaves accounts that already had access to the team", async () => {
    getUserByEmailMock.mockResolvedValueOnce({
      uid: "uid-1",
      email: "fulano@gmail.com",
      disabled: false,
      customClaims: { sap: { access: "revoked", tier: "allowed", at: 1 } },
    });

    const response = await post(CREDENTIALS);

    expect(response.status).toBe(409);
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  it("refuses requests from another site", async () => {
    const response = await POST(
      new Request(`${ORIGIN}/api/account/withdraw`, {
        method: "POST",
        body: JSON.stringify(CREDENTIALS),
        headers: {
          "Content-Type": "application/json",
          origin: "https://evil.example",
          "sec-fetch-site": "cross-site",
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(getUserByEmailMock).not.toHaveBeenCalled();
  });

  it("limits how often passwords can be tried", async () => {
    checkPasswordMock.mockResolvedValue("wrong");

    for (let attempt = 0; attempt < 10; attempt += 1) {
      await post(CREDENTIALS);
    }
    const response = await post(CREDENTIALS);

    expect(response.status).toBe(429);
    expect(checkPasswordMock).toHaveBeenCalledTimes(10);
  });
});
