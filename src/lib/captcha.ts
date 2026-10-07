/**
 * Confere, com a Cloudflare, que quem mandou o formulário passou pelo Turnstile.
 *
 * O widget no navegador só entrega um token; quem decide é esta função, com a
 * chave secreta que nunca sai do servidor. Pular o widget não adianta: sem um
 * token que a Cloudflare aprove, a rota para antes de criar conta ou mandar
 * e-mail.
 */

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Curto: quem espera é uma pessoa olhando o botão de enviar. */
const SITEVERIFY_TIMEOUT_MS = 5000;

/**
 * Cada tela resolve o captcha com a sua action. Conferir a action impede que um
 * token resolvido para reenviar e-mail seja usado para criar conta.
 */
export type CaptchaAction = "signup" | "resend";

/** A mesma para qualquer e-mail: a recusa do captcha não pode virar oráculo. */
export const CAPTCHA_FAILED_MESSAGE =
  "Não foi possível confirmar que você não é um robô. Tente novamente.";

type SiteverifyResponse = {
  success: boolean;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
  metadata?: { result_with_testing_key?: boolean };
};

type VerifyCaptchaOptions = {
  action: CaptchaAction;
  remoteIp?: string;
};

/**
 * Falha fechada: rede fora, resposta estranha ou secret ausente recusam. Deixar
 * passar nesses casos abriria a porta justamente quando ninguém está olhando, e
 * quem é gente só precisa tentar de novo.
 */
export async function verifyCaptcha(
  token: string,
  { action, remoteIp }: VerifyCaptchaOptions,
) {
  if (!token) return false;

  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    console.error(
      "TURNSTILE_SECRET_KEY não configurada: o cadastro e o reenvio estão recusando todo mundo.",
    );
    return false;
  }

  const form = new URLSearchParams({ secret, response: token });
  if (remoteIp) form.set("remoteip", remoteIp);

  let result: SiteverifyResponse;

  try {
    const response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(SITEVERIFY_TIMEOUT_MS),
    });
    result = (await response.json()) as SiteverifyResponse;
  } catch (error) {
    console.error("Falha ao consultar o Turnstile.", error);
    return false;
  }

  if (!result.success) return false;

  // A chave de teste aprova qualquer token e não devolve action. Fora de
  // produção é o que faz o desenvolvimento local funcionar; em produção é o
  // captcha desligado sem ninguém saber.
  if (result.metadata?.result_with_testing_key) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "TURNSTILE_SECRET_KEY é a chave de teste da Cloudflare em produção: o captcha está recusando todo mundo até a chave real ser configurada.",
      );
      return false;
    }

    return true;
  }

  return result.action === action;
}
