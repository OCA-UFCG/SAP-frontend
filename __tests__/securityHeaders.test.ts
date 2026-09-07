import { describe, expect, it } from "vitest";

import {
  buildContentSecurityPolicy,
  buildSecurityHeaders,
} from "@/config/securityHeaders";

function headerValue(key: string) {
  return buildSecurityHeaders().find((header) => header.key === key)?.value;
}

describe("security headers", () => {
  // Regressão: nenhuma resposta do app trazia cabeçalho de segurança, então a
  // plataforma autenticada podia ser embutida em um iframe de qualquer site.
  it("blocks framing and content type sniffing", () => {
    expect(headerValue("X-Frame-Options")).toBe("DENY");
    expect(headerValue("X-Content-Type-Options")).toBe("nosniff");
  });

  it("asks browsers to stay on https", () => {
    expect(headerValue("Strict-Transport-Security")).toContain(
      "max-age=63072000",
    );
  });

  it("ships the content policy in report-only mode", () => {
    expect(headerValue("Content-Security-Policy-Report-Only")).toBe(
      buildContentSecurityPolicy(),
    );
    expect(headerValue("Content-Security-Policy")).toBeUndefined();
  });

  it("allows the origins the browser really loads", () => {
    const policy = buildContentSecurityPolicy();

    expect(policy).toContain("https://images.ctfassets.net");
    expect(policy).toContain("https://*.tile.openstreetmap.org");
    expect(policy).toContain("https://server.arcgisonline.com");
    // O MapLibre cria o worker do mapa a partir de um blob.
    expect(policy).toContain("worker-src 'self' blob:");
    expect(policy).toContain("frame-ancestors 'none'");
  });
});
