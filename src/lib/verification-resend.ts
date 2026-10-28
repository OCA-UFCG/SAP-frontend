import { VERIFICATION_EMAIL_COOLDOWN_SECONDS } from "@/config/verificationEmailCooldown";

/**
 * O que a tela pode dizer depois de pedir outro e-mail de confirmação.
 *
 * Só duas recusas são contadas: captcha e espera. O resto continua com a
 * resposta genérica de "enviado", para o reenviar não virar oráculo de quem tem
 * conta.
 */
export type ResendOutcome =
  | { status: "sent" }
  | { status: "captcha" }
  | { status: "wait"; seconds: number };

export async function requestVerificationResend(
  email: string,
  captchaToken: string,
): Promise<ResendOutcome> {
  const response = await fetch("/api/signup/resend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, captchaToken }),
  }).catch(() => undefined);

  if (response?.status === 400) return { status: "captcha" };

  if (response?.status === 429) {
    const seconds = Number(response.headers.get("Retry-After"));
    return {
      status: "wait",
      seconds:
        Number.isFinite(seconds) && seconds > 0
          ? Math.ceil(seconds)
          : VERIFICATION_EMAIL_COOLDOWN_SECONDS,
    };
  }

  return { status: "sent" };
}
