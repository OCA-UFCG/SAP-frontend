import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  isAllowedSignupDomain,
  parseAllowedSignupDomains,
  resolveSignupTier,
} from "@/lib/signup-domains";

describe("signup domains", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes and dedupes the allowed domain env", () => {
    expect(
      parseAllowedSignupDomains(" UFCG.edu.br, @sedes.pb.gov.br , ,ufcg.EDU.br "),
    ).toEqual(new Set(["ufcg.edu.br", "sedes.pb.gov.br"]));
  });

  it("refuses every domain when the allowlist is empty", () => {
    vi.stubEnv("SIGNUP_ALLOWED_DOMAINS", "");

    expect(isAllowedSignupDomain("alguem@ufcg.edu.br")).toBe(false);
  });

  it("allows an email whose domain is on the list, ignoring case and spacing", () => {
    vi.stubEnv("SIGNUP_ALLOWED_DOMAINS", "ufcg.edu.br");

    expect(isAllowedSignupDomain("  Fulano@UFCG.edu.BR ")).toBe(true);
  });

  it("refuses an email whose domain is not on the list", () => {
    vi.stubEnv("SIGNUP_ALLOWED_DOMAINS", "ufcg.edu.br");

    expect(isAllowedSignupDomain("fulano@gmail.com")).toBe(false);
  });

  // Casamento exato, nunca por sufixo: `ccc.ufcg.edu.br` só entra se estiver
  // escrito na lista. Casar por sufixo deixaria `naoufcg.edu.br` passar.
  it("does not treat a subdomain as covered by its parent domain", () => {
    vi.stubEnv("SIGNUP_ALLOWED_DOMAINS", "ufcg.edu.br");

    expect(isAllowedSignupDomain("fulano@ccc.ufcg.edu.br")).toBe(false);
    expect(isAllowedSignupDomain("fulano@naoufcg.edu.br")).toBe(false);
  });

  it("refuses an address that is not a single well-formed email", () => {
    vi.stubEnv("SIGNUP_ALLOWED_DOMAINS", "ufcg.edu.br");

    expect(isAllowedSignupDomain("fulano@ufcg.edu.br@ufcg.edu.br")).toBe(false);
    expect(isAllowedSignupDomain("ufcg.edu.br")).toBe(false);
    expect(isAllowedSignupDomain("fulano@")).toBe(false);
    expect(isAllowedSignupDomain("")).toBe(false);
    expect(isAllowedSignupDomain(null)).toBe(false);
  });

  it("resolves the tier that decides which trail the signup follows", () => {
    vi.stubEnv("SIGNUP_ALLOWED_DOMAINS", "ufcg.edu.br");

    expect(resolveSignupTier("fulano@ufcg.edu.br")).toBe("allowed");
    expect(resolveSignupTier("fulano@gmail.com")).toBe("common");
  });

  // A lista é lida a cada chamada, como em logs-access: tirar um domínio do
  // ambiente precisa valer no request seguinte, sem esperar cache nenhum.
  it("stops allowing a domain as soon as the env stops naming it", () => {
    vi.stubEnv("SIGNUP_ALLOWED_DOMAINS", "ufcg.edu.br");
    expect(isAllowedSignupDomain("fulano@ufcg.edu.br")).toBe(true);

    vi.stubEnv("SIGNUP_ALLOWED_DOMAINS", "sedes.pb.gov.br");
    expect(isAllowedSignupDomain("fulano@ufcg.edu.br")).toBe(false);
  });
});
