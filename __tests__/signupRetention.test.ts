import { beforeEach, describe, expect, it, vi } from "vitest";

const { docs, users, deleteDocMock, deleteUserMock } = vi.hoisted(() => ({
  docs: new Map<string, Record<string, unknown>>(),
  users: new Map<string, Record<string, unknown>>(),
  deleteDocMock: vi.fn(),
  deleteUserMock: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({
      where: (_field: string, _op: string, status: string) => ({
        get: async () => ({
          docs: [...docs.entries()]
            .filter(([, data]) => data.status === status)
            .map(([id, data]) => ({ id, data: () => data })),
        }),
      }),
      doc: (id: string) => ({ delete: () => deleteDocMock(id) }),
    }),
  },
  adminAuth: {
    getUser: async (uid: string) => {
      const user = users.get(uid);
      if (!user) throw new Error("user-not-found");
      return user;
    },
    deleteUser: deleteUserMock,
  },
}));

import {
  purgeExpiredSignups,
  REJECTED_SIGNUP_RETENTION_DAYS,
  UNCONFIRMED_SIGNUP_RETENTION_DAYS,
} from "@/lib/signup-retention";

const NOW = Date.parse("2026-10-26T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number) {
  return new Date(NOW - days * DAY).toISOString();
}

function pending(createdDaysAgo: number) {
  return { status: "pending", createdAt: daysAgo(createdDaysAgo), decidedAt: null };
}

function rejected(decidedDaysAgo: number) {
  return {
    status: "rejected",
    createdAt: daysAgo(decidedDaysAgo + 1),
    decidedAt: daysAgo(decidedDaysAgo),
  };
}

describe("purgeExpiredSignups", () => {
  beforeEach(() => {
    docs.clear();
    users.clear();
    vi.clearAllMocks();
  });

  it("deletes an unconfirmed signup past its deadline, account and record", async () => {
    docs.set("old", pending(UNCONFIRMED_SIGNUP_RETENTION_DAYS + 1));
    users.set("old", { emailVerified: false, disabled: false });

    await expect(purgeExpiredSignups(NOW)).resolves.toEqual({
      unconfirmed: 1,
      rejected: 0,
    });
    expect(deleteUserMock).toHaveBeenCalledWith("old");
    expect(deleteDocMock).toHaveBeenCalledWith("old");
  });

  it("keeps an unconfirmed signup still inside its deadline", async () => {
    docs.set("new", pending(UNCONFIRMED_SIGNUP_RETENTION_DAYS - 1));
    users.set("new", { emailVerified: false, disabled: false });

    await purgeExpiredSignups(NOW);

    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(deleteDocMock).not.toHaveBeenCalled();
  });

  // Confirmou o e-mail e espera a equipe: está na fila, não abandonado.
  it("keeps an old pending request whose email was confirmed", async () => {
    docs.set("waiting", pending(UNCONFIRMED_SIGNUP_RETENTION_DAYS + 30));
    users.set("waiting", { emailVerified: true, disabled: false });

    await purgeExpiredSignups(NOW);

    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(deleteDocMock).not.toHaveBeenCalled();
  });

  it("deletes a rejected request past its deadline", async () => {
    docs.set("refused", rejected(REJECTED_SIGNUP_RETENTION_DAYS + 1));
    users.set("refused", { emailVerified: true, disabled: true });
    docs.set("recent", rejected(REJECTED_SIGNUP_RETENTION_DAYS - 1));
    users.set("recent", { emailVerified: true, disabled: true });

    await expect(purgeExpiredSignups(NOW)).resolves.toEqual({
      unconfirmed: 0,
      rejected: 1,
    });
    expect(deleteUserMock).toHaveBeenCalledTimes(1);
    expect(deleteUserMock).toHaveBeenCalledWith("refused");
    expect(deleteDocMock).toHaveBeenCalledWith("refused");
  });

  it("keeps a rejected account that someone enabled again", async () => {
    docs.set("reenabled", rejected(REJECTED_SIGNUP_RETENTION_DAYS + 1));
    users.set("reenabled", { emailVerified: true, disabled: false });

    await purgeExpiredSignups(NOW);

    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(deleteDocMock).not.toHaveBeenCalled();
  });

  // O projeto do Firebase é dividido: uma conta com a marca do SAP nunca é
  // apagada pela limpeza, qualquer que seja o estado do pedido.
  it("never deletes an account that carries SAP access", async () => {
    docs.set("approved", pending(UNCONFIRMED_SIGNUP_RETENTION_DAYS + 1));
    users.set("approved", {
      emailVerified: false,
      disabled: false,
      customClaims: { sap: { access: "approved", tier: "common", at: 1 } },
    });

    await purgeExpiredSignups(NOW);

    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(deleteDocMock).not.toHaveBeenCalled();
  });

  it("removes the record left behind when the account is already gone", async () => {
    docs.set("orphan", pending(UNCONFIRMED_SIGNUP_RETENTION_DAYS + 1));

    await purgeExpiredSignups(NOW);

    expect(deleteUserMock).not.toHaveBeenCalled();
    expect(deleteDocMock).toHaveBeenCalledWith("orphan");
  });
});
