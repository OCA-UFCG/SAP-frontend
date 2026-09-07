import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readTrustedProxyCount,
  resolveTrustedClientIp,
} from "@/utils/requestClientIp";

function requestWithHeaders(headers: Record<string, string>) {
  return new Request("https://sap.example/api/logs", { headers });
}

describe("resolveTrustedClientIp", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  // Regressão: a guarda de taxa anônima de /api/logs lia o primeiro item do
  // X-Forwarded-For, que é escrito pelo cliente. Bastava trocar esse valor a
  // cada requisição para nunca bater no limite e gravar telemetria sem fim.
  it("ignores the spoofable prefix of the forwarded chain", () => {
    const request = requestWithHeaders({
      "x-forwarded-for": "1.2.3.4, 5.6.7.8, 203.0.113.7",
    });

    expect(resolveTrustedClientIp(request, 1)).toBe("203.0.113.7");
  });

  it("skips as many hops as there are trusted proxies", () => {
    const request = requestWithHeaders({
      "x-forwarded-for": "1.2.3.4, 203.0.113.7, 198.51.100.1",
    });

    expect(resolveTrustedClientIp(request, 2)).toBe("203.0.113.7");
  });

  it("keeps the first hop when the chain is shorter than the proxy count", () => {
    const request = requestWithHeaders({ "x-forwarded-for": "203.0.113.7" });

    expect(resolveTrustedClientIp(request, 3)).toBe("203.0.113.7");
  });

  it("reads IPv6 addresses from the chain", () => {
    const request = requestWithHeaders({
      "x-forwarded-for": "spoofed, 2001:db8::1",
    });

    expect(resolveTrustedClientIp(request, 1)).toBe("2001:db8::1");
  });

  it("falls back to x-real-ip when there is no forwarded chain", () => {
    const request = requestWithHeaders({ "x-real-ip": "203.0.113.9" });

    expect(resolveTrustedClientIp(request)).toBe("203.0.113.9");
  });

  it("returns null when no header carries something shaped like an address", () => {
    expect(
      resolveTrustedClientIp(
        requestWithHeaders({ "x-forwarded-for": "not-an-address" }),
      ),
    ).toBeNull();
    expect(resolveTrustedClientIp(requestWithHeaders({}))).toBeNull();
  });
});

describe("readTrustedProxyCount", () => {
  it("defaults to the single nginx in front of the app", () => {
    expect(readTrustedProxyCount(undefined)).toBe(1);
    expect(readTrustedProxyCount("")).toBe(1);
    expect(readTrustedProxyCount("0")).toBe(1);
    expect(readTrustedProxyCount("abc")).toBe(1);
  });

  it("reads a longer proxy chain from the environment", () => {
    expect(readTrustedProxyCount("2")).toBe(2);
  });
});
