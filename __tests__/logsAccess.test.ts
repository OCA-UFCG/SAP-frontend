import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    verifySessionCookie: vi.fn(),
    getUser: vi.fn(),
  },
}));

import {
  isAllowedLogsViewerEmail,
  parseAllowedLogsViewerEmails,
  resolveLogsViewerAccess,
} from "@/lib/logs-access";
import { adminAuth } from "@/lib/firebase-admin";
import { clearVerifiedSessionCache } from "@/lib/verified-session-cache";

const mockedAdminAuth = vi.mocked(adminAuth);

const HOUR_FROM_NOW_SECONDS = Math.floor(Date.now() / 1000) + 3600;

function mockVerifiedSession(email: string, uid = "user-123") {
  mockedAdminAuth.verifySessionCookie.mockResolvedValue({
    uid,
    email,
    exp: HOUR_FROM_NOW_SECONDS,
  } as never);
}

describe("logs access", () => {
  beforeEach(() => {
    mockedAdminAuth.verifySessionCookie.mockReset();
    mockedAdminAuth.getUser.mockReset();
    clearVerifiedSessionCache();
    vi.unstubAllEnvs();
  });

  it("normalizes and parses the allowed email env", () => {
    expect(
      parseAllowedLogsViewerEmails(
        " OCA@gmail.com, oca-dev@gmail.com , ,OCA@gmail.com ",
      ),
    ).toEqual(new Set(["oca@gmail.com", "oca-dev@gmail.com"]));
  });

  it("returns unauthenticated when there is no session cookie", async () => {
    await expect(resolveLogsViewerAccess(null)).resolves.toBe(
      "unauthenticated",
    );
    expect(mockedAdminAuth.verifySessionCookie).not.toHaveBeenCalled();
  });

  it("returns allowed for an authenticated allowlisted email", async () => {
    vi.stubEnv("LOGS_ALLOWED_EMAILS", "oca@gmail.com,oca-dev@gmail.com");
    mockVerifiedSession("OCA@gmail.com");

    await expect(resolveLogsViewerAccess("valid-session")).resolves.toBe(
      "allowed",
    );
  });

  it("returns forbidden for an authenticated email outside the allowlist", async () => {
    vi.stubEnv("LOGS_ALLOWED_EMAILS", "oca@gmail.com,oca-dev@gmail.com");
    mockVerifiedSession("other@gmail.com", "user-456");

    await expect(resolveLogsViewerAccess("valid-session")).resolves.toBe(
      "forbidden",
    );
  });

  it("returns unauthenticated when the session cookie does not verify", async () => {
    vi.stubEnv("LOGS_ALLOWED_EMAILS", "oca@gmail.com");
    mockedAdminAuth.verifySessionCookie.mockRejectedValue(
      new Error("auth/session-cookie-revoked") as never,
    );

    await expect(resolveLogsViewerAccess("revoked-session")).resolves.toBe(
      "unauthenticated",
    );
  });

  // Regressão de desempenho: a versão anterior verificava o cookie e ainda
  // chamava `getUser` em toda renderização de página da plataforma, duas idas
  // ao Identity Toolkit (~600 ms) por navegação entre seções.
  it("reuses the verified session instead of going to Firebase again", async () => {
    vi.stubEnv("LOGS_ALLOWED_EMAILS", "oca@gmail.com");
    mockVerifiedSession("oca@gmail.com");

    await resolveLogsViewerAccess("valid-session");
    await resolveLogsViewerAccess("valid-session");

    expect(mockedAdminAuth.verifySessionCookie).toHaveBeenCalledTimes(1);
    expect(mockedAdminAuth.getUser).not.toHaveBeenCalled();
  });

  // A sessão fica em cache, a allowlist não: tirar alguém de
  // LOGS_ALLOWED_EMAILS precisa valer no request seguinte.
  it("drops access as soon as the allowlist stops naming the email", async () => {
    vi.stubEnv("LOGS_ALLOWED_EMAILS", "oca@gmail.com");
    mockVerifiedSession("oca@gmail.com");

    await expect(resolveLogsViewerAccess("valid-session")).resolves.toBe(
      "allowed",
    );

    vi.stubEnv("LOGS_ALLOWED_EMAILS", "outra-pessoa@gmail.com");

    await expect(resolveLogsViewerAccess("valid-session")).resolves.toBe(
      "forbidden",
    );
  });

  it("refuses an authenticated session when the allowlist is empty", () => {
    vi.stubEnv("LOGS_ALLOWED_EMAILS", "");

    expect(isAllowedLogsViewerEmail("oca@gmail.com")).toBe(false);
  });
});
