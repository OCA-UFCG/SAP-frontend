import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkPasswordResetCode,
  resetPasswordWithCode,
} from "@/lib/password-reset-code";

const RESET_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=chave-publica";

function firebaseError(message: string) {
  return Response.json({ error: { message } }, { status: 400 });
}

describe("password reset code", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "chave-publica");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("checkPasswordResetCode", () => {
    // Só conferir não pode gastar o código: sem `newPassword`, o Firebase
    // apenas diz de quem ele é.
    it("asks Firebase about the code without a new password", async () => {
      fetchMock.mockResolvedValue(
        Response.json({ email: "Fulano@UFCG.edu.br", requestType: "PASSWORD_RESET" }),
      );

      await expect(checkPasswordResetCode("ABC123")).resolves.toBe(
        "fulano@ufcg.edu.br",
      );

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(RESET_URL);
      expect(JSON.parse(init.body as string)).toEqual({ oobCode: "ABC123" });
    });

    it("returns null for an expired or used code", async () => {
      fetchMock.mockResolvedValue(firebaseError("EXPIRED_OOB_CODE"));

      await expect(checkPasswordResetCode("VENCIDO")).resolves.toBeNull();
    });

    // O código de confirmação de endereço também é um oobCode; não pode abrir
    // a troca de senha.
    it("refuses a code issued for something other than a password reset", async () => {
      fetchMock.mockResolvedValue(
        Response.json({ email: "fulano@ufcg.edu.br", requestType: "VERIFY_EMAIL" }),
      );

      await expect(checkPasswordResetCode("DE-OUTRA-COISA")).resolves.toBeNull();
    });
  });

  describe("resetPasswordWithCode", () => {
    it("changes the password and says whose it was", async () => {
      fetchMock.mockResolvedValue(
        Response.json({ email: "fulano@ufcg.edu.br", requestType: "PASSWORD_RESET" }),
      );

      await expect(resetPasswordWithCode("ABC123", "senha-nova-1")).resolves.toEqual({
        status: "changed",
        email: "fulano@ufcg.edu.br",
      });

      const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(JSON.parse(init.body as string)).toEqual({
        oobCode: "ABC123",
        newPassword: "senha-nova-1",
      });
    });

    it.each(["EXPIRED_OOB_CODE", "INVALID_OOB_CODE"])(
      "tells an unusable code (%s) apart from other failures",
      async (message) => {
        fetchMock.mockResolvedValue(firebaseError(message));

        await expect(resetPasswordWithCode("X", "senha-nova-1")).resolves.toEqual({
          status: "invalid-code",
        });
      },
    );

    it.each([
      "WEAK_PASSWORD : Password should be at least 6 characters",
      "PASSWORD_DOES_NOT_MEET_REQUIREMENTS:Missing password requirements: [Password must contain a numeric character]",
    ])("reports a password the policy refuses (%s)", async (message) => {
      fetchMock.mockResolvedValue(firebaseError(message));

      await expect(resetPasswordWithCode("X", "fraquinha")).resolves.toEqual({
        status: "weak-password",
      });
    });

    it("fails closed without the API key", async () => {
      vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "");
      vi.spyOn(console, "error").mockImplementation(() => undefined);

      await expect(resetPasswordWithCode("X", "senha-nova-1")).resolves.toEqual({
        status: "failed",
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("never lets the code or the password reach the log", async () => {
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
      fetchMock.mockRejectedValue(
        new Error("falha de rede com oobCode=SEGREDO e senha SENHA-SECRETA"),
      );

      await expect(
        resetPasswordWithCode("SEGREDO", "SENHA-SECRETA"),
      ).resolves.toEqual({ status: "failed" });

      const logged = error.mock.calls.flat().join(" ");
      expect(logged).not.toContain("SEGREDO");
      expect(logged).not.toContain("SENHA-SECRETA");
    });
  });
});
