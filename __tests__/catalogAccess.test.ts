import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    verifySessionCookie: vi.fn(),
  },
}));

import {
  hasTrustedMutationOrigin,
  resolveCatalogRequestAccess,
} from "@/lib/catalog-access";
import { adminAuth } from "@/lib/firebase-admin";
import { clearVerifiedSessionCache } from "@/lib/verified-session-cache";

const mockedAdminAuth = vi.mocked(adminAuth);

describe("index catalog access", () => {
  beforeEach(() => {
    // Os casos reaproveitam o mesmo cookie com identidades diferentes, então o
    // cache de sessões verificadas precisa começar vazio em cada um.
    clearVerifiedSessionCache();
    mockedAdminAuth.verifySessionCookie.mockReset();
    vi.unstubAllEnvs();
    vi.stubEnv("LOGS_ALLOWED_EMAILS", "oca-dev@gmail.com");
  });

  it("uses the audit allowlist for an authenticated session", async () => {
    mockedAdminAuth.verifySessionCookie.mockResolvedValueOnce({
      uid: "user-1",
      email: "OCA-DEV@gmail.com",
      email_verified: true,
    } as never);

    await expect(
      resolveCatalogRequestAccess(
        new Request("https://sap.example/api/index-catalog", {
          headers: { cookie: "session=valid-cookie" },
        }),
      ),
    ).resolves.toEqual({
      allowed: true,
      user: {
        uid: "user-1",
        email: "oca-dev@gmail.com",
        hasVerifiedEmail: true,
      },
    });
  });

  // Regressão: com o autocadastro do Firebase aberto, quem registrasse um
  // e-mail da allowlist que ainda não tinha conta ganhava escrita no Contentful.
  // Verificar o e-mail exige a caixa de entrada, que o impostor não tem.
  it("rejects an allowlisted email whose account never verified it", async () => {
    mockedAdminAuth.verifySessionCookie.mockResolvedValueOnce({
      uid: "user-3",
      email: "oca-dev@gmail.com",
      email_verified: false,
    } as never);

    await expect(
      resolveCatalogRequestAccess(
        new Request("https://sap.example/api/index-catalog", {
          headers: { cookie: "session=valid-cookie" },
        }),
      ),
    ).resolves.toEqual({ allowed: false, status: 403 });
  });

  it("rejects authenticated users outside the allowlist", async () => {
    mockedAdminAuth.verifySessionCookie.mockResolvedValueOnce({
      uid: "user-2",
      email: "other@example.com",
    } as never);

    await expect(
      resolveCatalogRequestAccess(
        new Request("https://sap.example/api/index-catalog", {
          headers: { cookie: "session=valid-cookie" },
        }),
      ),
    ).resolves.toEqual({ allowed: false, status: 403 });
  });

  it("accepts only same-origin mutations with browser origin evidence", () => {
    expect(
      hasTrustedMutationOrigin(
        new Request("https://sap.example/api/index-catalog", {
          headers: {
            origin: "https://sap.example",
            "sec-fetch-site": "same-origin",
          },
        }),
      ),
    ).toBe(true);
    expect(
      hasTrustedMutationOrigin(
        new Request("https://sap.example/api/index-catalog", {
          headers: {
            origin: "https://attacker.example",
            "sec-fetch-site": "cross-site",
          },
        }),
      ),
    ).toBe(false);
    expect(
      hasTrustedMutationOrigin(
        new Request("https://sap.example/api/index-catalog"),
      ),
    ).toBe(false);
  });
});
