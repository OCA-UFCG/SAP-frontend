import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionMock, checkPasswordMock, deleteAccountMock } = vi.hoisted(
  () => ({
    getSessionMock: vi.fn(),
    checkPasswordMock: vi.fn(),
    deleteAccountMock: vi.fn(),
  }),
);

vi.mock("@/lib/firebase-admin", () => ({ adminAuth: {}, adminDb: {} }));

vi.mock("@/lib/server-session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server-session")>();
  return { ...actual, getAuthenticatedUserSession: getSessionMock };
});

vi.mock("@/lib/account-management", () => ({
  checkAccountPassword: checkPasswordMock,
  deleteAccount: deleteAccountMock,
}));

import { POST } from "@/app/api/account/delete/route";

const ORIGIN = "https://sap.example";

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    new Request(`${ORIGIN}/api/account/delete`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
        origin: ORIGIN,
        "sec-fetch-site": "same-origin",
        ...headers,
      },
    }),
  );
}

function session(tier: "allowed" | "common" | "legacy") {
  return {
    uid: "uid-1",
    email: "fulano@gmail.com",
    access: { access: "approved", tier, at: 1 },
  };
}

describe("POST /api/account/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSessionMock.mockResolvedValue(session("common"));
    checkPasswordMock.mockResolvedValue("ok");
  });

  it("deletes the account and ends the session once the password checks out", async () => {
    const response = await post({ password: "senha-certa" });

    expect(response.status).toBe(200);
    expect(checkPasswordMock).toHaveBeenCalledWith(
      "uid-1",
      "fulano@gmail.com",
      "senha-certa",
    );
    expect(deleteAccountMock).toHaveBeenCalledWith("uid-1");
    expect(response.headers.get("set-cookie")).toMatch(/session=;.*Max-Age=0/i);
  });

  it("does not delete with a wrong password", async () => {
    checkPasswordMock.mockResolvedValue("wrong");

    const response = await post({ password: "errada" });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ code: "wrong_password" });
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  it("sends older, possibly shared accounts to the team", async () => {
    getSessionMock.mockResolvedValue(session("legacy"));

    const response = await post({ password: "senha-certa" });

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ code: "ask_team" });
    expect(checkPasswordMock).not.toHaveBeenCalled();
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  it("requires a session", async () => {
    getSessionMock.mockResolvedValue(null);

    expect((await post({ password: "x" })).status).toBe(401);
  });

  it("refuses requests from another site", async () => {
    const response = await post(
      { password: "senha-certa" },
      { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    );

    expect(response.status).toBe(403);
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });
});
