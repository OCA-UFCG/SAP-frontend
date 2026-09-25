import { describe, expect, it } from "vitest";

import {
  buildBackfillClaims,
  shouldBackfillUser,
} from "../scripts/backfill-access-claims.mjs";
import { buildApprovedAccessClaims } from "@/lib/access-claims";

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
    expect(shouldBackfillUser({ uid: "user-123", customClaims: {} })).toBe(true);
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

  it("marks an account whose claim is malformed for backfill", () => {
    expect(
      shouldBackfillUser({ uid: "user-123", customClaims: { sap: "approved" } }),
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
});
