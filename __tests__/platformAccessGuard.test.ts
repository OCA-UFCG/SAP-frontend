import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    verifySessionCookie: vi.fn(),
  },
}));

import { resolvePlatformAccess } from "@/lib/platform-access";
import { adminAuth } from "@/lib/firebase-admin";
import { clearVerifiedSessionCache } from "@/lib/verified-session-cache";
import { buildApprovedAccessClaims } from "@/lib/access-claims";

const mockedAdminAuth = vi.mocked(adminAuth);

const HOUR_FROM_NOW_SECONDS = Math.floor(Date.now() / 1000) + 3600;

function mockVerifiedSession(claims: Record<string, unknown> = {}) {
  mockedAdminAuth.verifySessionCookie.mockResolvedValue({
    uid: "user-123",
    email: "fulano@ufcg.edu.br",
    exp: HOUR_FROM_NOW_SECONDS,
    ...claims,
  } as never);
}

describe("platform access guard", () => {
  beforeEach(() => {
    mockedAdminAuth.verifySessionCookie.mockReset();
    clearVerifiedSessionCache();
    vi.unstubAllEnvs();
  });

  it("returns unauthenticated when there is no session cookie", async () => {
    await expect(resolvePlatformAccess(null)).resolves.toBe("unauthenticated");
    expect(mockedAdminAuth.verifySessionCookie).not.toHaveBeenCalled();
  });

  it("returns unauthenticated when the session cookie does not verify", async () => {
    mockedAdminAuth.verifySessionCookie.mockRejectedValue(
      new Error("auth/session-cookie-revoked") as never,
    );

    await expect(resolvePlatformAccess("revoked")).resolves.toBe(
      "unauthenticated",
    );
  });

  it("returns approved when the token carries the access claim", async () => {
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "true");
    mockVerifiedSession(buildApprovedAccessClaims("allowed"));

    await expect(resolvePlatformAccess("valid-session")).resolves.toBe(
      "approved",
    );
  });

  it("returns unapproved when the guard is on and the token has no claim", async () => {
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "true");
    mockVerifiedSession();

    await expect(resolvePlatformAccess("valid-session")).resolves.toBe(
      "unapproved",
    );
  });

  // Toda conta que existe hoje está sem claim. Ligar o guard antes do backfill
  // trancaria essas pessoas para fora, então ele nasce desligado e só é ligado
  // depois que o script da fase 2 rodar.
  it("lets a session without the claim through while the guard is off", async () => {
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "false");
    mockVerifiedSession();

    await expect(resolvePlatformAccess("valid-session")).resolves.toBe(
      "approved",
    );
  });

  it("keeps the guard off when the env does not name it", async () => {
    mockVerifiedSession();

    await expect(resolvePlatformAccess("valid-session")).resolves.toBe(
      "approved",
    );
  });

  // A sessão fica em cache, a flag não: ligar o guard vale no request seguinte.
  it("starts blocking as soon as the guard is switched on", async () => {
    mockVerifiedSession();

    await expect(resolvePlatformAccess("valid-session")).resolves.toBe(
      "approved",
    );

    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "true");

    await expect(resolvePlatformAccess("valid-session")).resolves.toBe(
      "unapproved",
    );
  });

  it("reuses the verified session instead of going to Firebase again", async () => {
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "true");
    mockVerifiedSession(buildApprovedAccessClaims("common"));

    await resolvePlatformAccess("valid-session");
    await resolvePlatformAccess("valid-session");

    expect(mockedAdminAuth.verifySessionCookie).toHaveBeenCalledTimes(1);
  });
});
