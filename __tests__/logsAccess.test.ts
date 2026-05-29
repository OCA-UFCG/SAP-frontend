import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    verifySessionCookie: vi.fn(),
    getUser: vi.fn(),
  },
}));

import {
  parseAllowedLogsViewerEmails,
  resolveLogsViewerAccess,
} from "@/lib/logs-access";
import { adminAuth } from "@/lib/firebase-admin";

const mockedAdminAuth = vi.mocked(adminAuth);

describe("logs access", () => {
  beforeEach(() => {
    mockedAdminAuth.verifySessionCookie.mockReset();
    mockedAdminAuth.getUser.mockReset();
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
    mockedAdminAuth.verifySessionCookie.mockResolvedValueOnce({
      uid: "user-123",
    } as never);
    mockedAdminAuth.getUser.mockResolvedValueOnce({
      email: "OCA@gmail.com",
    } as never);

    await expect(resolveLogsViewerAccess("valid-session")).resolves.toBe(
      "allowed",
    );
  });

  it("returns forbidden for an authenticated email outside the allowlist", async () => {
    vi.stubEnv("LOGS_ALLOWED_EMAILS", "oca@gmail.com,oca-dev@gmail.com");
    mockedAdminAuth.verifySessionCookie.mockResolvedValueOnce({
      uid: "user-456",
    } as never);
    mockedAdminAuth.getUser.mockResolvedValueOnce({
      email: "other@gmail.com",
    } as never);

    await expect(resolveLogsViewerAccess("valid-session")).resolves.toBe(
      "forbidden",
    );
  });
});
