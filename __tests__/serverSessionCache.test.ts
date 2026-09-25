import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { fakeAdminAuth } = vi.hoisted(() => {
  class FakeAdminAuth {
    verifySessionCookie = vi.fn();
  }

  return { fakeAdminAuth: new FakeAdminAuth() };
});

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: fakeAdminAuth,
}));

import {
  getAuthenticatedUserId,
  getAuthenticatedUserSession,
  verifyFirebaseSessionCookie,
} from "@/lib/server-session";
import { clearVerifiedSessionCache } from "@/lib/verified-session-cache";

const SESSION_COOKIE = "session-cookie-for-user-123";
const ONE_HOUR_FROM_NOW_SECONDS = Math.floor(Date.now() / 1000) + 3600;

function createRequest(sessionCookie = SESSION_COOKIE): Request {
  return new Request("https://example.test/api/ee", {
    headers: { Cookie: `session=${sessionCookie}` },
  });
}

function decodedToken(overrides: Record<string, unknown> = {}) {
  return {
    uid: "user-123",
    email: "Dev@Example.COM",
    exp: ONE_HOUR_FROM_NOW_SECONDS,
    ...overrides,
  };
}

describe("verified session cache", () => {
  beforeEach(() => {
    clearVerifiedSessionCache();
    fakeAdminAuth.verifySessionCookie.mockReset();
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("verifies the session cookie against Firebase only once per window", async () => {
    fakeAdminAuth.verifySessionCookie.mockResolvedValue(decodedToken());

    const first = await getAuthenticatedUserSession(createRequest());
    const second = await getAuthenticatedUserSession(createRequest());
    const third = await getAuthenticatedUserId(createRequest());

    expect(fakeAdminAuth.verifySessionCookie).toHaveBeenCalledTimes(1);
    expect(fakeAdminAuth.verifySessionCookie).toHaveBeenCalledWith(
      SESSION_COOKIE,
      true,
    );
    expect(first).toEqual({
      uid: "user-123",
      email: "dev@example.com",
      access: null,
    });
    expect(second).toEqual(first);
    expect(third).toBe("user-123");
  });

  it("keeps a separate verification per session cookie", async () => {
    fakeAdminAuth.verifySessionCookie
      .mockResolvedValueOnce(decodedToken())
      .mockResolvedValueOnce(decodedToken({ uid: "user-456" }));

    const first = await getAuthenticatedUserId(createRequest());
    const second = await getAuthenticatedUserId(
      createRequest("another-session-cookie"),
    );

    expect(fakeAdminAuth.verifySessionCookie).toHaveBeenCalledTimes(2);
    expect(first).toBe("user-123");
    expect(second).toBe("user-456");
  });

  it("revalidates against Firebase after the cache window expires", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    fakeAdminAuth.verifySessionCookie.mockResolvedValue(
      decodedToken({ exp: 24 * 60 * 60 }),
    );

    await getAuthenticatedUserId(createRequest());
    vi.advanceTimersByTime(59_000);
    await getAuthenticatedUserId(createRequest());
    vi.advanceTimersByTime(2_000);
    await getAuthenticatedUserId(createRequest());

    expect(fakeAdminAuth.verifySessionCookie).toHaveBeenCalledTimes(2);
  });

  it("never caches a session past the expiry of its own cookie", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    // Token com 10 s de vida: o TTL de 60 s do cache não pode estendê-lo.
    fakeAdminAuth.verifySessionCookie.mockResolvedValue(
      decodedToken({ exp: 10 }),
    );

    await getAuthenticatedUserId(createRequest());
    vi.advanceTimersByTime(11_000);
    await getAuthenticatedUserId(createRequest());

    expect(fakeAdminAuth.verifySessionCookie).toHaveBeenCalledTimes(2);
  });

  it("does not cache a rejected session cookie", async () => {
    fakeAdminAuth.verifySessionCookie.mockRejectedValue(
      new Error("session cookie revoked"),
    );

    const first = await verifyFirebaseSessionCookie(SESSION_COOKIE);
    const second = await verifyFirebaseSessionCookie(SESSION_COOKIE);

    expect(first).toBe(false);
    expect(second).toBe(false);
    expect(fakeAdminAuth.verifySessionCookie).toHaveBeenCalledTimes(2);
  });

  it("does not reach Firebase when there is no session cookie", async () => {
    const session = await getAuthenticatedUserSession(
      new Request("https://example.test/api/ee"),
    );

    expect(session).toBeNull();
    expect(fakeAdminAuth.verifySessionCookie).not.toHaveBeenCalled();
  });

  it("honors the configured cache window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    vi.stubEnv("SESSION_VERIFICATION_CACHE_TTL_SECONDS", "5");
    fakeAdminAuth.verifySessionCookie.mockResolvedValue(
      decodedToken({ exp: 24 * 60 * 60 }),
    );

    await getAuthenticatedUserId(createRequest());
    vi.advanceTimersByTime(6_000);
    await getAuthenticatedUserId(createRequest());

    expect(fakeAdminAuth.verifySessionCookie).toHaveBeenCalledTimes(2);
  });

  it("does not cache a session whose token carries no usable expiry", async () => {
    // Regressão: com `exp` ausente, Math.min(now + ttl, NaN) produzia NaN e a
    // entrada nunca expirava, mantendo a sessão válida para sempre no processo.
    fakeAdminAuth.verifySessionCookie.mockResolvedValue({
      uid: "user-123",
      email: "dev@example.com",
    });

    await getAuthenticatedUserId(createRequest());
    await getAuthenticatedUserId(createRequest());

    expect(fakeAdminAuth.verifySessionCookie).toHaveBeenCalledTimes(2);
  });
});
