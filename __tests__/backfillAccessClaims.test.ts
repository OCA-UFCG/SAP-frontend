import { describe, expect, it } from "vitest";

import {
  backfillUser,
  buildBackfillClaims,
  listSignupUids,
  shouldBackfillUser,
} from "../scripts/backfill-access-claims.mjs";
import { buildApprovedAccessClaims } from "@/lib/access-claims";

/** Admin SDK de mentira: registra a ordem das chamadas que o backfill faz. */
class FakeFirebaseAdminAuth {
  calls: string[] = [];

  async setCustomUserClaims(uid: string) {
    this.calls.push(`claims:${uid}`);
  }

  async revokeRefreshTokens(uid: string) {
    this.calls.push(`revoke:${uid}`);
  }
}

describe("backfill access claims", () => {
  // O script é .mjs e não importa o TypeScript do app, então os dois formatos
  // podem divergir sem ninguém perceber — e o resultado seria um backfill que
  // grava um claim que o guard não reconhece, trancando todo mundo para fora.
  // Este teste amarra os dois.
  it("writes exactly the claim shape the app reads", () => {
    expect(buildBackfillClaims({}, 1758585600)).toEqual(
      buildApprovedAccessClaims("legacy", 1758585600),
    );
  });

  it("marks an account without any claim for backfill", () => {
    expect(shouldBackfillUser({ uid: "user-123" })).toBe(true);
    expect(shouldBackfillUser({ uid: "user-123", customClaims: {} })).toBe(
      true,
    );
  });

  // Rodar o script duas vezes não pode revogar a sessão de quem já está certo:
  // `approveAccess` derruba o token, e um re-run cego deslogaria a plataforma
  // inteira.
  it("skips an account that already carries a valid claim", () => {
    expect(
      shouldBackfillUser({
        uid: "user-123",
        customClaims: buildApprovedAccessClaims("allowed", 1758585600),
      }),
    ).toBe(false);
  });

  // Regressão: o script liberava qualquer conta sem a marca, inclusive quem se
  // cadastrou e ainda espera a decisão da equipe — ou já foi recusado.
  it("leaves accounts that came from the signup to the approvals screen", () => {
    expect(
      shouldBackfillUser({ uid: "pendente-123" }, new Set(["pendente-123"])),
    ).toBe(false);
    expect(
      shouldBackfillUser({ uid: "antiga-456" }, new Set(["pendente-123"])),
    ).toBe(true);
  });

  it("collects the signup accounts from every access-request list", async () => {
    const lists: Record<string, string[]> = {
      "access-requests": ["beta-1"],
      "access-requests-local": ["local-1", "beta-1"],
    };
    const db = {
      collection: (name: string) => ({
        listDocuments: async () => (lists[name] ?? []).map((id) => ({ id })),
      }),
    };

    expect(
      await listSignupUids(db, ["access-requests", "access-requests-local"]),
    ).toEqual(new Set(["beta-1", "local-1"]));
  });

  it("marks an account whose claim is malformed for backfill", () => {
    expect(
      shouldBackfillUser({
        uid: "user-123",
        customClaims: { sap: "approved" },
      }),
    ).toBe(true);
    expect(
      shouldBackfillUser({
        uid: "user-123",
        customClaims: { sap: { access: "pending" } },
      }),
    ).toBe(true);
  });

  // `setCustomUserClaims` substitui o conjunto inteiro de claims, não mescla.
  // Escrever só o nosso apagaria qualquer outro que a conta tivesse.
  it("keeps claims that belong to someone else", () => {
    expect(
      buildBackfillClaims({ outroSistema: { papel: "admin" } }, 1758585600),
    ).toEqual({
      outroSistema: { papel: "admin" },
      ...buildApprovedAccessClaims("legacy", 1758585600),
    });
  });

  // Regressão: sem revogar, quem estava logado quando a flag foi ligada tinha um
  // cookie sem a marca e caía na página de espera por até 24 h, apesar de já
  // liberado pelo backfill.
  it("logs the account out after granting the claim, in that order", async () => {
    const auth = new FakeFirebaseAdminAuth();

    await backfillUser(auth, { uid: "user-1", customClaims: {} }, 1758585600);

    expect(auth.calls).toEqual(["claims:user-1", "revoke:user-1"]);
  });
});
