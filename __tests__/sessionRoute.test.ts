import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server-session", () => ({
  createFirebaseSessionCookie: vi.fn(),
  SESSION_COOKIE_MAX_AGE_SECONDS: 86400,
  SESSION_COOKIE_NAME: "session",
}));

import { DELETE, POST } from "@/app/api/session/route";
import { createFirebaseSessionCookie } from "@/lib/server-session";

const mockedCreateFirebaseSessionCookie = vi.mocked(
  createFirebaseSessionCookie,
);

describe("/api/session", () => {
  beforeEach(() => {
    mockedCreateFirebaseSessionCookie.mockReset();
  });

  it("sets an HTTP-only session cookie only after token validation", async () => {
    mockedCreateFirebaseSessionCookie.mockResolvedValueOnce(
      "firebase-session-cookie",
    );

    const response = await POST(
      new Request("https://example.test/api/session", {
        method: "POST",
        body: JSON.stringify({ token: "firebase-id-token" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mockedCreateFirebaseSessionCookie).toHaveBeenCalledWith(
      "firebase-id-token",
    );
    expect(response.headers.get("set-cookie")).toContain(
      "session=firebase-session-cookie",
    );
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
  });

  it("rejects invalid tokens without setting a cookie", async () => {
    mockedCreateFirebaseSessionCookie.mockRejectedValueOnce(
      new Error("invalid token"),
    );

    const response = await POST(
      new Request("https://example.test/api/session", {
        method: "POST",
        body: JSON.stringify({ token: "invalid-token" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("expires the session cookie on logout", async () => {
    const response = await DELETE();

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("session=;");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
