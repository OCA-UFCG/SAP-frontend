import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { fakeAdminAuth } = vi.hoisted(() => ({
  fakeAdminAuth: { verifySessionCookie: vi.fn() },
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: fakeAdminAuth,
}));

import {
  getPlatformRequesterKey,
  requireAuthenticatedRequest,
} from "@/lib/server-session";
import { clearVerifiedSessionCache } from "@/lib/verified-session-cache";

const VISITOR_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";

function request(headers: Record<string, string> = {}) {
  return new Request("https://sap.test/api/ee/map-urls", { headers });
}

describe("platform open to visitors without login", () => {
  beforeEach(() => {
    clearVerifiedSessionCache();
    fakeAdminAuth.verifySessionCookie.mockReset();
    fakeAdminAuth.verifySessionCookie.mockRejectedValue(new Error("invalid"));
    vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", "false");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("lets the data routes answer without a session", async () => {
    await expect(requireAuthenticatedRequest(request())).resolves.toBeNull();
  });

  it("counts usage per browser when the visitor cookie is there", async () => {
    await expect(
      getPlatformRequesterKey(
        request({
          cookie: `sedes_visitor=${VISITOR_ID}`,
          "x-real-ip": "200.1.1.1",
        }),
      ),
    ).resolves.toBe(`visitor:${VISITOR_ID}`);
  });

  it("falls back to the network address when the cookie is missing or forged", async () => {
    await expect(
      getPlatformRequesterKey(request({ "x-real-ip": "200.1.1.1" })),
    ).resolves.toBe("ip:200.1.1.1");
    await expect(
      getPlatformRequesterKey(
        request({
          cookie: `sedes_visitor=${"x".repeat(5000)}`,
          "x-real-ip": "200.1.1.1",
        }),
      ),
    ).resolves.toBe("ip:200.1.1.1");
  });

  it("keeps counting a logged-in person by their account", async () => {
    fakeAdminAuth.verifySessionCookie.mockResolvedValue({
      uid: "user-123",
      email: "equipe@lsd.ufcg.edu.br",
      exp: Math.floor(Date.now() / 1000) + 3600,
    });

    await expect(
      getPlatformRequesterKey(
        request({ cookie: `session=abc; sedes_visitor=${VISITOR_ID}` }),
      ),
    ).resolves.toBe("user-123");
  });
});

describe("platform behind login", () => {
  beforeEach(() => {
    clearVerifiedSessionCache();
    fakeAdminAuth.verifySessionCookie.mockReset();
    fakeAdminAuth.verifySessionCookie.mockRejectedValue(new Error("invalid"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(["true", undefined])(
    "keeps refusing visitors without login (flag %s)",
    async (flag) => {
      vi.stubEnv("PLATFORM_ACCESS_GUARD_ENABLED", flag);
      const visitor = request({ cookie: `sedes_visitor=${VISITOR_ID}` });

      await expect(getPlatformRequesterKey(visitor)).resolves.toBeNull();
      expect((await requireAuthenticatedRequest(visitor))?.status).toBe(401);
    },
  );
});
