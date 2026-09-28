import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    getUser: vi.fn(),
    setCustomUserClaims: vi.fn(),
    revokeRefreshTokens: vi.fn(),
  },
}));

import {
  approveAccess,
  buildApprovedAccessClaims,
  hasApprovedAccess,
  readAccessClaim,
} from "@/lib/access-claims";
import { adminAuth } from "@/lib/firebase-admin";

const mockedAdminAuth = vi.mocked(adminAuth);

describe("access claims", () => {
  beforeEach(() => {
    mockedAdminAuth.getUser.mockReset().mockResolvedValue({ customClaims: undefined } as never);
    mockedAdminAuth.setCustomUserClaims.mockReset().mockResolvedValue(undefined);
    mockedAdminAuth.revokeRefreshTokens.mockReset().mockResolvedValue(undefined);
  });

  it("builds the approved claim under the sap namespace", () => {
    expect(buildApprovedAccessClaims("allowed", 1758585600)).toEqual({
      sap: { access: "approved", tier: "allowed", at: 1758585600 },
    });
  });

  it("reads an approved claim out of a decoded token", () => {
    const decoded = buildApprovedAccessClaims("common", 1758585600);

    expect(hasApprovedAccess(decoded)).toBe(true);
    expect(readAccessClaim(decoded)).toEqual({
      access: "approved",
      tier: "common",
      at: 1758585600,
    });
  });

  // Toda conta que existe hoje cai neste caso até o backfill rodar.
  it("treats a token without the claim as not approved", () => {
    expect(hasApprovedAccess({ uid: "user-123" })).toBe(false);
    expect(readAccessClaim({ uid: "user-123" })).toBeNull();
  });

  // Quem já usava a plataforma antes do cadastro existir não entrou por domínio
  // nem por aprovação do OCA. Um tier próprio mantém o relatório honesto.
  it("accepts the legacy tier of accounts that predate the signup flow", () => {
    const decoded = buildApprovedAccessClaims("legacy", 1758585600);

    expect(hasApprovedAccess(decoded)).toBe(true);
    expect(readAccessClaim(decoded)?.tier).toBe("legacy");
  });

  it("treats a malformed claim as not approved", () => {
    expect(hasApprovedAccess({ sap: "approved" })).toBe(false);
    expect(hasApprovedAccess({ sap: { access: "pending" } })).toBe(false);
    expect(hasApprovedAccess({ sap: {} })).toBe(false);
    expect(hasApprovedAccess(null)).toBe(false);
    expect(hasApprovedAccess(undefined)).toBe(false);
  });

  // `setCustomUserClaims` substitui o conjunto inteiro, não mescla. O script de
  // backfill já documenta essa armadilha e preserva os claims de terceiros;
  // aqui ela estava sendo ignorada. Hoje não quebra porque nenhum outro claim
  // existe — mas quem criar um papel de administrador o veria evaporar na
  // primeira aprovação, e pareceria bug do Firebase.
  it("keeps claims that belong to someone else", async () => {
    mockedAdminAuth.getUser.mockResolvedValue({
      customClaims: { outroSistema: { papel: "admin" } },
    } as never);

    await approveAccess("user-123", "common", 1758585600);

    expect(mockedAdminAuth.setCustomUserClaims).toHaveBeenCalledWith("user-123", {
      outroSistema: { papel: "admin" },
      sap: { access: "approved", tier: "common", at: 1758585600 },
    });
  });

  it("writes the claim when approving someone", async () => {
    await approveAccess("user-123", "common", 1758585600);

    expect(mockedAdminAuth.setCustomUserClaims).toHaveBeenCalledWith("user-123", {
      sap: { access: "approved", tier: "common", at: 1758585600 },
    });
  });

  // O claim é carimbado no cookie no momento em que ele é criado, então um
  // cookie já emitido nunca passa a carregá-lo. Sem revogar, alguém aprovado
  // hoje só entraria quando o cookie de 24 h expirasse.
  it("revokes the refresh tokens so an open session cannot linger without the claim", async () => {
    await approveAccess("user-123", "allowed", 1758585600);

    expect(mockedAdminAuth.revokeRefreshTokens).toHaveBeenCalledWith("user-123");
  });

  it("does not revoke when writing the claim failed", async () => {
    mockedAdminAuth.setCustomUserClaims.mockRejectedValue(new Error("boom"));

    await expect(approveAccess("user-123", "allowed")).rejects.toThrow("boom");
    expect(mockedAdminAuth.revokeRefreshTokens).not.toHaveBeenCalled();
  });
});
