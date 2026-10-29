import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pingGeeMock, getContentMock, firestoreGetMock, verifyMailerMock } =
  vi.hoisted(() => ({
    pingGeeMock: vi.fn(),
    getContentMock: vi.fn(),
    firestoreGetMock: vi.fn(),
    verifyMailerMock: vi.fn(),
  }));

vi.mock("server-only", () => ({}));

vi.mock("@/infrastructure/earth-engine/client", () => ({
  pingGee: pingGeeMock,
}));

vi.mock("@/infrastructure/contentful/client", () => ({
  getContent: getContentMock,
}));

vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: () => ({ doc: () => ({ get: firestoreGetMock }) }),
  },
}));

vi.mock("@/lib/mailer", () => ({
  isMailerConfigured: () =>
    Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD),
  verifyMailer: verifyMailerMock,
}));

import { GET } from "@/app/api/health/route";
import {
  CONTENTFUL_OK_TTL_MS,
  HEALTH_CHECK_TIMEOUT_MS,
  HEALTH_REPORT_TTL_MS,
  resetHealthChecks,
} from "@/app/api/health/checks";

const fetchMock = vi.fn();

beforeEach(() => {
  resetHealthChecks();
  vi.stubEnv("GEE_PRIVATE_KEY", "{}");
  vi.stubEnv("FIREBASE_CLIENT_EMAIL", "sa@example.com");
  vi.stubEnv("API_BASE_URL", "http://backend:8000/");
  vi.stubEnv("SMTP_USER", "oca@example.com");
  vi.stubEnv("SMTP_PASSWORD", "senha");
  pingGeeMock.mockReset().mockResolvedValue(undefined);
  getContentMock.mockReset().mockResolvedValue({ __typename: "Query" });
  firestoreGetMock.mockReset().mockResolvedValue({ exists: false });
  verifyMailerMock.mockReset().mockResolvedValue(true);
  fetchMock.mockReset().mockResolvedValue(new Response("[]", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("GET /api/health", () => {
  it("answers 200 when every dependency responds", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.status).toBe("ok");
    expect(Object.keys(body.dependencies).sort()).toEqual([
      "contentful",
      "firebase",
      "gee",
      "multicriteria",
      "smtp",
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://backend:8000/api/v1/criterias",
      expect.anything(),
    );
  });

  it("answers 503 naming the dependency that failed, without leaking its message", async () => {
    pingGeeMock.mockRejectedValue(
      new Error("Google OAuth token exchange failed (invalid_grant)."),
    );

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body.status).toBe("fail");
    expect(body.dependencies.gee).toMatchObject({ ok: false, error: "failed" });
    expect(body.dependencies.contentful.ok).toBe(true);
    expect(JSON.stringify(body)).not.toContain("invalid_grant");
  });

  it("reports the HTTP status of a backend that is up but without its data", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));

    const body = await (await GET()).json();

    expect(body.dependencies.multicriteria).toMatchObject({
      ok: false,
      error: "HTTP 503",
    });
  });

  it("tells a missing credential apart from a failing service", async () => {
    vi.stubEnv("SMTP_PASSWORD", "");

    const body = await (await GET()).json();

    expect(body.dependencies.smtp).toMatchObject({
      ok: false,
      error: "not configured",
    });
    expect(verifyMailerMock).not.toHaveBeenCalled();
  });

  it("gives up on a dependency that hangs instead of hanging the route", async () => {
    vi.useFakeTimers();
    getContentMock.mockReturnValue(new Promise(() => {}));

    const pending = GET();
    await vi.advanceTimersByTimeAsync(HEALTH_CHECK_TIMEOUT_MS);
    const body = await (await pending).json();

    expect(body.dependencies.contentful).toMatchObject({
      ok: false,
      error: "timeout",
    });
  });

  it("reuses a recent check so calling the route in a loop does not reach the services", async () => {
    vi.useFakeTimers();

    await Promise.all([GET(), GET()]);
    await GET();
    expect(pingGeeMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(HEALTH_REPORT_TTL_MS + 1);
    await GET();
    expect(pingGeeMock).toHaveBeenCalledTimes(2);
  });

  it("logs into SMTP far less often than it checks the rest", async () => {
    vi.useFakeTimers();

    await GET();
    await vi.advanceTimersByTimeAsync(HEALTH_REPORT_TTL_MS + 1);
    await GET();

    expect(pingGeeMock).toHaveBeenCalledTimes(2);
    expect(verifyMailerMock).toHaveBeenCalledTimes(1);
  });

  it("calls Contentful only every 15 min while it answers, since each call counts in its monthly quota", async () => {
    vi.useFakeTimers();

    await GET();
    await vi.advanceTimersByTimeAsync(HEALTH_REPORT_TTL_MS + 1);
    await GET();
    expect(pingGeeMock).toHaveBeenCalledTimes(2);
    expect(getContentMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(CONTENTFUL_OK_TTL_MS);
    await GET();
    expect(getContentMock).toHaveBeenCalledTimes(2);
  });

  it("checks Contentful again on the next round after it fails", async () => {
    vi.useFakeTimers();
    getContentMock.mockRejectedValueOnce(
      Object.assign(new Error("boom"), { status: 503 }),
    );

    const first = await (await GET()).json();
    await vi.advanceTimersByTimeAsync(HEALTH_REPORT_TTL_MS + 1);
    const second = await (await GET()).json();

    expect(first.dependencies.contentful).toMatchObject({
      ok: false,
      error: "HTTP 503",
    });
    expect(second.dependencies.contentful.ok).toBe(true);
    expect(getContentMock).toHaveBeenCalledTimes(2);
  });

  it("logs a failure once, not on every check while it lasts", async () => {
    vi.useFakeTimers();
    firestoreGetMock.mockRejectedValue(new Error("PERMISSION_DENIED"));

    await GET();
    await vi.advanceTimersByTimeAsync(HEALTH_REPORT_TTL_MS + 1);
    await GET();

    expect(console.error).toHaveBeenCalledTimes(1);
  });
});
