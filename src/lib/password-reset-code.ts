/**
 * Troca de senha sem passar pela página do Firebase.
 *
 * Mesmo desenho da confirmação de endereço (`email-verification-code.ts`): o
 * e-mail leva só o código de uso único para a nossa página, e o servidor o
 * entrega ao Firebase por trás. A pessoa nunca vê a tela em inglês com o nome
 * interno do projeto.
 *
 * O código e a senha são credenciais: nada aqui os registra em log.
 */

const RESET_PASSWORD_URL =
  "https://identitytoolkit.googleapis.com/v1/accounts:resetPassword";

export type PasswordResetResult =
  | { status: "changed"; email: string }
  | { status: "invalid-code" }
  | { status: "weak-password" }
  | { status: "failed" };

type ResetPasswordResponse =
  | { ok: true; email: string | null; requestType?: string }
  | { ok: false; message: string };

/** Código vencido, já usado ou inventado: pedir outro link resolve. */
const INVALID_CODE_ERRORS = [
  "EXPIRED_OOB_CODE",
  "INVALID_OOB_CODE",
  "EMAIL_NOT_FOUND",
  "USER_DISABLED",
];

/** A password policy do Firebase recusou a senha nova. */
const WEAK_PASSWORD_ERRORS = [
  "WEAK_PASSWORD",
  "PASSWORD_DOES_NOT_MEET_REQUIREMENTS",
];

function matches(message: string, errors: string[]) {
  return errors.some((error) => message.startsWith(error));
}

async function callResetPassword(
  body: Record<string, string>,
): Promise<ResetPasswordResponse | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;

  if (!apiKey) {
    console.error(
      "Não dá para trocar a senha: NEXT_PUBLIC_FIREBASE_API_KEY não está configurada.",
    );
    return null;
  }

  try {
    const response = await fetch(
      `${RESET_PASSWORD_URL}?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
        cache: "no-store",
      },
    );

    const payload = (await response.json().catch(() => null)) as {
      email?: unknown;
      requestType?: unknown;
      error?: { message?: unknown };
    } | null;

    if (!response.ok) {
      const message = payload?.error?.message;
      return { ok: false, message: typeof message === "string" ? message : "" };
    }

    const email = payload?.email;
    return {
      ok: true,
      email: typeof email === "string" && email ? email.toLowerCase() : null,
      requestType:
        typeof payload?.requestType === "string"
          ? payload.requestType
          : undefined,
    };
  } catch {
    console.error("Falha ao falar com o Firebase para trocar a senha.");
    return null;
  }
}

/**
 * Confere o código sem gastá-lo. Devolve o e-mail da conta, para a página
 * mostrar de quem é a senha que está sendo trocada, ou `null` quando o código
 * não vale.
 */
export async function checkPasswordResetCode(code: string) {
  const result = await callResetPassword({ oobCode: code });

  if (!result?.ok || !result.email) return null;

  // Um código de confirmação de endereço também é aceito pelo endpoint. Não é
  // o que este link deveria carregar.
  if (result.requestType && result.requestType !== "PASSWORD_RESET") {
    return null;
  }

  return result.email;
}

/**
 * Troca a senha. O Firebase gasta o código e invalida as sessões abertas com a
 * senha antiga.
 */
export async function resetPasswordWithCode(
  code: string,
  newPassword: string,
): Promise<PasswordResetResult> {
  const result = await callResetPassword({ oobCode: code, newPassword });

  if (!result) return { status: "failed" };

  if (result.ok) {
    return result.email
      ? { status: "changed", email: result.email }
      : { status: "failed" };
  }

  if (matches(result.message, INVALID_CODE_ERRORS)) {
    return { status: "invalid-code" };
  }

  if (matches(result.message, WEAK_PASSWORD_ERRORS)) {
    return { status: "weak-password" };
  }

  // O texto do Firebase só diz o tipo do erro, nunca o código nem a senha.
  console.error("O Firebase recusou a troca de senha.", result.message);
  return { status: "failed" };
}
