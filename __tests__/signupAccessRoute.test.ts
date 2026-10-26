import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  requireCatalogAccessMock,
  getUserMock,
  approveAccessMock,
  revokeAccessMock,
  recordAccessChangeMock,
  deleteAccountMock,
  calls,
} = vi.hoisted(() => {
  const calls: string[] = [];
  return {
    calls,
    requireCatalogAccessMock: vi.fn(),
    getUserMock: vi.fn(),
    approveAccessMock: vi.fn(async () => {
      calls.push("approve");
    }),
    revokeAccessMock: vi.fn(async () => {
      calls.push("revoke");
      return "legacy";
    }),
    recordAccessChangeMock: vi.fn(async () => {
      calls.push("record");
    }),
    deleteAccountMock: vi.fn(),
  };
});

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: { getUser: getUserMock },
  adminDb: {},
}));

vi.mock("@/app/api/index-catalog/http", () => ({
  requireCatalogAccess: requireCatalogAccessMock,
}));

vi.mock("@/lib/access-claims", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/access-claims")>();
  return {
    ...actual,
    approveAccess: approveAccessMock,
    revokeAccess: revokeAccessMock,
  };
});

vi.mock("@/lib/access-requests", () => ({
  recordAccessChange: recordAccessChangeMock,
}));

vi.mock("@/lib/account-management", () => ({
  deleteAccount: deleteAccountMock,
}));

import { POST } from "@/app/api/signup/access/route";

const OPERATOR = { uid: "admin-1", email: "operador@lsd.ufcg.edu.br", access: null };

function post(body: unknown) {
  return POST(
    new Request("https://sap.example/api/signup/access", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
  );
}

function user(claim?: { access: string; tier: string }) {
  return {
    uid: "uid-1",
    email: "fulano@lsd.ufcg.edu.br",
    customClaims: claim ? { sap: { ...claim, at: 1 } } : undefined,
  };
}

describe("POST /api/signup/access", () => {
  beforeEach(() => {
    calls.length = 0;
    vi.clearAllMocks();
    requireCatalogAccessMock.mockResolvedValue({ user: OPERATOR });
    getUserMock.mockResolvedValue(user({ access: "approved", tier: "legacy" }));
  });

  it("only lets operators in", async () => {
    requireCatalogAccessMock.mockResolvedValue({
      response: new Response(null, { status: 403 }),
    });

    expect((await post({ uid: "uid-1", action: "revoke" })).status).toBe(403);
    expect(revokeAccessMock).not.toHaveBeenCalled();
  });

  it("refuses to act on the operator's own account", async () => {
    const response = await post({ uid: "admin-1", action: "delete" });

    expect(response.status).toBe(409);
    expect(deleteAccountMock).not.toHaveBeenCalled();
  });

  it("records the removal before removing, so the next login cannot grant it back", async () => {
    const response = await post({ uid: "uid-1", action: "revoke" });

    expect(response.status).toBe(200);
    expect(calls).toEqual(["record", "revoke"]);
    expect(recordAccessChangeMock).toHaveBeenCalledWith("uid-1", {
      status: "revoked",
      email: "fulano@lsd.ufcg.edu.br",
      tier: "legacy",
      decidedBy: OPERATOR.email,
    });
  });

  it("restores a removed access with the tier the account had", async () => {
    getUserMock.mockResolvedValue(user({ access: "revoked", tier: "common" }));

    const response = await post({ uid: "uid-1", action: "restore" });

    expect(response.status).toBe(200);
    expect(calls).toEqual(["record", "approve"]);
    expect(approveAccessMock).toHaveBeenCalledWith("uid-1", "common");
  });

  it("does not restore an account whose access was never removed", async () => {
    const response = await post({ uid: "uid-1", action: "restore" });

    expect(response.status).toBe(409);
    expect(approveAccessMock).not.toHaveBeenCalled();
  });

  it("deletes the account", async () => {
    const response = await post({ uid: "uid-1", action: "delete" });

    expect(response.status).toBe(200);
    expect(deleteAccountMock).toHaveBeenCalledWith("uid-1");
  });

  it("rejects unknown actions", async () => {
    expect((await post({ uid: "uid-1", action: "ban" })).status).toBe(400);
  });
});
