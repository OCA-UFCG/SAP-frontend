import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyToAnalysisBackend } from "@/app/api/amfe/backendProxy";

class FakeBackend {
  readonly calls: Array<{ url: string; init: RequestInit | undefined }> = [];

  constructor(
    private readonly response: { status: number; body: string } | Error,
  ) {}

  fetch = async (url: string | URL, init?: RequestInit) => {
    this.calls.push({ url: String(url), init });

    if (this.response instanceof Error) throw this.response;

    return new Response(this.response.body, { status: this.response.status });
  };
}

const install = (backend: FakeBackend) => {
  vi.stubGlobal("fetch", backend.fetch);
  return backend;
};

beforeEach(() => {
  process.env.API_BASE_URL = "http://backend.test/";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.API_BASE_URL;
});

describe("proxyToAnalysisBackend", () => {
  it("strips trailing slashes from the configured base URL", async () => {
    const backend = install(
      new FakeBackend({ status: 200, body: '{"result":{}}' }),
    );

    await proxyToAnalysisBackend("/api/v1/analyze", { method: "POST" });

    expect(backend.calls[0].url).toBe("http://backend.test/api/v1/analyze");
  });

  it("passes the backend payload and status straight through", async () => {
    install(new FakeBackend({ status: 200, body: '{"count":42}' }));

    const response = await proxyToAnalysisBackend("/api/v1/criterias", {
      method: "GET",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ count: 42 });
  });

  it("preserves the backend error status instead of masking it as 500", async () => {
    install(new FakeBackend({ status: 422, body: '{"detail":"peso invalido"}' }));

    const response = await proxyToAnalysisBackend("/api/v1/analyze", {
      method: "POST",
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({ detail: "peso invalido" });
  });

  it("wraps a non-JSON backend body so the client always gets JSON", async () => {
    install(new FakeBackend({ status: 500, body: "Internal Server Error" }));

    const response = await proxyToAnalysisBackend("/api/v1/analyze", {
      method: "POST",
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      detail: "Internal Server Error",
    });
  });

  it("reports a missing API_BASE_URL as a 500 naming the variable", async () => {
    delete process.env.API_BASE_URL;
    install(new FakeBackend({ status: 200, body: "{}" }));

    const response = await proxyToAnalysisBackend("/api/v1/criterias", {
      method: "GET",
    });

    expect(response.status).toBe(500);
    const payload = (await response.json()) as { error: string };
    expect(payload.error).toContain("API_BASE_URL");
  });

  it("turns an unreachable backend into a 500 instead of throwing", async () => {
    install(new FakeBackend(new Error("ECONNREFUSED")));

    const response = await proxyToAnalysisBackend("/api/v1/analyze", {
      method: "POST",
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "ECONNREFUSED" });
  });
});
