import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const { getAuthenticatedUserIdMock, proxyMock } = vi.hoisted(() => ({
  getAuthenticatedUserIdMock: vi.fn(),
  proxyMock: vi.fn(),
}));

vi.mock("@/lib/server-session", () => ({
  getAuthenticatedUserId: getAuthenticatedUserIdMock,
}));

vi.mock("@/app/api/amfe/backendProxy", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/app/api/amfe/backendProxy")
  >();

  return { ...actual, proxyToAnalysisBackend: proxyMock };
});

import { POST as analyze } from "@/app/api/amfe/analyze/route";
import { GET as criterias } from "@/app/api/amfe/criterias/route";

const buildRequest = (body = "{}") =>
  ({
    text: async () => body,
    headers: new Headers(),
  }) as unknown as NextRequest;

beforeEach(() => {
  getAuthenticatedUserIdMock.mockReset();
  proxyMock.mockReset().mockResolvedValue(new Response("{}", { status: 200 }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("AMFE proxy routes", () => {
  it("refuses an anonymous analysis instead of driving work on the backend", async () => {
    getAuthenticatedUserIdMock.mockResolvedValue(null);

    const response = await analyze(buildRequest('{"criteria":[]}'));

    expect(response.status).toBe(401);
    expect(proxyMock).not.toHaveBeenCalled();
  });

  it("refuses an anonymous criteria listing", async () => {
    getAuthenticatedUserIdMock.mockResolvedValue(null);

    const response = await criterias(buildRequest());

    expect(response.status).toBe(401);
    expect(proxyMock).not.toHaveBeenCalled();
  });

  it("forwards the analysis for an authenticated session", async () => {
    getAuthenticatedUserIdMock.mockResolvedValue("uid-123");

    const response = await analyze(buildRequest('{"criteria":[]}'));

    expect(response.status).toBe(200);
    expect(proxyMock).toHaveBeenCalledWith(
      "/api/v1/analyze",
      expect.objectContaining({ method: "POST", body: '{"criteria":[]}' }),
    );
  });

  it("forwards the criteria listing for an authenticated session", async () => {
    getAuthenticatedUserIdMock.mockResolvedValue("uid-123");

    const response = await criterias(buildRequest());

    expect(response.status).toBe(200);
    expect(proxyMock).toHaveBeenCalledWith(
      "/api/v1/criterias",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
