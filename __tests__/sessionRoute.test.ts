import { beforeEach, describe, expect, it, vi } from "vitest";

const { settleSignupMock } = vi.hoisted(() => ({ settleSignupMock: vi.fn() }));

vi.mock("@/lib/server-session", () => ({
  createFirebaseSessionCookie: vi.fn(),
  SESSION_COOKIE_MAX_AGE_SECONDS: 86400,
  SESSION_COOKIE_NAME: "session",
}));

vi.mock("@/lib/signup-settlement", () => ({ settleSignup: settleSignupMock }));

import { DELETE, POST } from "@/app/api/session/route";
import { createFirebaseSessionCookie } from "@/lib/server-session";

const mockedCreateFirebaseSessionCookie = vi.mocked(
  createFirebaseSessionCookie,
);

function unapproved(overrides = {}) {
  return {
    status: "unapproved" as const,
    uid: "user-123",
    email: "fulano@ufcg.edu.br",
    emailVerified: true,
    ...overrides,
  };
}

function postSession(token = "firebase-id-token") {
  return POST(
    new Request("https://example.test/api/session", {
      method: "POST",
      body: JSON.stringify({ token }),
    }),
  );
}

describe("/api/session", () => {
  beforeEach(() => {
    mockedCreateFirebaseSessionCookie.mockReset();
    settleSignupMock.mockReset().mockResolvedValue("pending");
  });

  it("sets an HTTP-only session cookie only after token validation", async () => {
    mockedCreateFirebaseSessionCookie.mockResolvedValueOnce({
      status: "created",
      sessionCookie: "firebase-session-cookie",
    });

    const response = await postSession();

    expect(response.status).toBe(200);
    expect(mockedCreateFirebaseSessionCookie).toHaveBeenCalledWith(
      "firebase-id-token",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "session=firebase-session-cookie",
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  // O bloqueio de acesso acontece aqui, num ponto só: sem a marca de liberação
  // não nasce cookie, e sem cookie não há plataforma.
  it("refuses to open a session for an account that was never approved", async () => {
    mockedCreateFirebaseSessionCookie.mockResolvedValueOnce(unapproved());

    const response = await postSession();

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  // Quem confirma o endereço e fecha a aba nunca volta à nossa página, então o
  // cadastro nunca é fechado — e no trilho institucional o acesso automático
  // simplesmente não acontece. O login é a segunda chance: antes de recusar,
  // tenta fechar o cadastro pendente.
  it("settles a signup that never came back from the email, then lets the person in", async () => {
    mockedCreateFirebaseSessionCookie
      .mockResolvedValueOnce(unapproved())
      .mockResolvedValueOnce({
        status: "created",
        sessionCookie: "firebase-session-cookie",
      });
    settleSignupMock.mockResolvedValue("approved");

    const response = await postSession();

    expect(settleSignupMock).toHaveBeenCalledWith({
      uid: "user-123",
      email: "fulano@ufcg.edu.br",
      emailVerified: true,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain(
      "session=firebase-session-cookie",
    );
  });

  it("still refuses when settling leaves the person waiting for the team", async () => {
    mockedCreateFirebaseSessionCookie.mockResolvedValue(unapproved());
    settleSignupMock.mockResolvedValue("pending");

    const response = await postSession();

    expect(response.status).toBe(403);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  // Sem e-mail confirmado não há nada a fechar, e ir ao banco por isso seria
  // trabalho à toa em cada tentativa de login de quem não confirmou.
  it("does not try to settle an unconfirmed address", async () => {
    mockedCreateFirebaseSessionCookie.mockResolvedValue(
      unapproved({ emailVerified: false }),
    );

    await postSession();

    expect(settleSignupMock).not.toHaveBeenCalled();
  });

  // O cliente precisa distinguir "senha errada" de "cadastro em análise" para
  // levar a pessoa à página certa.
  it("names the pending approval so the client can route to the waiting page", async () => {
    mockedCreateFirebaseSessionCookie.mockResolvedValue(unapproved());

    const response = await postSession();

    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ code: "access_pending" }),
    );
  });

  it("rejects invalid tokens without setting a cookie", async () => {
    mockedCreateFirebaseSessionCookie.mockRejectedValueOnce(
      new Error("invalid token"),
    );

    const response = await postSession("invalid-token");

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("expires the session cookie on logout", async () => {
    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("session=;");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
