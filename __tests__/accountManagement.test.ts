import { beforeEach, describe, expect, it, vi } from "vitest";

const { calls, listUsersMock, readAccessRequestsMock } = vi.hoisted(() => ({
  calls: [] as string[],
  listUsersMock: vi.fn(),
  readAccessRequestsMock: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    deleteUser: vi.fn(async () => {
      calls.push("deleteUser");
    }),
    listUsers: listUsersMock,
  },
  adminDb: {},
}));

vi.mock("@/lib/access-requests", () => ({
  deleteAccessRequest: vi.fn(async () => {
    calls.push("deleteAccessRequest");
  }),
  readAccessRequests: readAccessRequestsMock,
}));

import {
  deleteAccount,
  listAccountsWithAccess,
} from "@/lib/account-management";

describe("account management", () => {
  beforeEach(() => {
    calls.length = 0;
  });

  it("erases the signup record before the account, so a failure never orphans it", async () => {
    await deleteAccount("uid-1");

    expect(calls).toEqual(["deleteAccessRequest", "deleteUser"]);
  });

  it("lists only accounts that carry the SAP mark, approved or removed", async () => {
    listUsersMock.mockResolvedValue({
      users: [
        { uid: "b", email: "b@x.br", customClaims: { sap: { access: "revoked", tier: "legacy", at: 2 } } },
        { uid: "a", email: "a@x.br", customClaims: { sap: { access: "approved", tier: "common", at: 1 } } },
        { uid: "c", email: "outro-sistema@x.br", customClaims: undefined },
      ],
      pageToken: undefined,
    });
    readAccessRequestsMock.mockResolvedValue(
      new Map([["a", { intention: "Pesquisa sobre seca" }]]),
    );

    const accounts = await listAccountsWithAccess();

    expect(accounts.map(({ uid }) => uid)).toEqual(["a", "b"]);
    expect(accounts[0]).toMatchObject({ access: "approved", intention: "Pesquisa sobre seca" });
    expect(accounts[1]).toMatchObject({ access: "revoked", tier: "legacy", intention: "" });
  });
});
