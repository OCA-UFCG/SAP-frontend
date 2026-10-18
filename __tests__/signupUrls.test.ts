import { afterEach, describe, expect, it, vi } from "vitest";

import { approvalsUrl, loginUrl, passwordResetUrl } from "@/lib/signup-urls";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("signup-urls", () => {
  it("uses the e-mail domain when no override is set", () => {
    vi.stubEnv("ADMIN_LINKS_BASE_URL", "");
    vi.stubEnv("PUBLIC_LINKS_BASE_URL", "");
    vi.stubEnv("EMAIL_LINKS_BASE_URL", "https://sedes.oca-portal.com/");

    expect(approvalsUrl()).toBe(
      "https://sedes.oca-portal.com/platform/aprovacoes",
    );
    expect(loginUrl()).toBe("https://sedes.oca-portal.com/login");
  });

  it("sends the OCA to the beta approvals from production", () => {
    vi.stubEnv("EMAIL_LINKS_BASE_URL", "https://sedes.oca-portal.com");
    vi.stubEnv("ADMIN_LINKS_BASE_URL", "https://beta-sap.lsd.ufcg.edu.br");

    expect(approvalsUrl()).toBe(
      "https://beta-sap.lsd.ufcg.edu.br/platform/aprovacoes",
    );
    expect(passwordResetUrl("pt")).toBe(
      "https://sedes.oca-portal.com/pt/redefinir-senha",
    );
  });

  it("sends approved people from the beta to production", () => {
    vi.stubEnv("EMAIL_LINKS_BASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_HOST_URL", "https://beta-sap.lsd.ufcg.edu.br");
    vi.stubEnv("PUBLIC_LINKS_BASE_URL", "https://sedes.oca-portal.com");

    expect(loginUrl()).toBe("https://sedes.oca-portal.com/login");
    expect(approvalsUrl()).toBe(
      "https://beta-sap.lsd.ufcg.edu.br/platform/aprovacoes",
    );
  });
});
