import { adminAuth } from "@/lib/firebase-admin";
import { sendMail } from "@/lib/mailer";
import { buildExistingAccountEmail } from "@/lib/signup-emails";
import { sendVerificationEmail } from "@/lib/signup-verification";
import { forgotPasswordUrl, signupLoginUrl } from "@/lib/signup-urls";

/**
 * Responde por e-mail a um cadastro feito com endereço que já tem conta.
 *
 * A tela continua dizendo o mesmo "confira seu e-mail" de um cadastro novo,
 * para não contar a um estranho quem tem conta. O recado vai só para a caixa
 * do próprio endereço, que é quem pode saber:
 *
 * - **conta sem endereço confirmado** (um cadastro anterior que parou no meio):
 *   o e-mail de confirmação de novo, que é o que faltava;
 * - **conta confirmada** (muitas vezes criada em outra plataforma do OCA, que
 *   divide o mesmo Firebase): um aviso para entrar com a senha que já existe.
 *   O login abre o pedido de acesso que faltar (`settleSignup`);
 * - **conta desabilitada** (pedido recusado): nada, como antes.
 *
 * Falhas só vão para o log: quem chama responde igual de qualquer forma.
 */
export async function notifyExistingAccount(email: string, locale?: string) {
  try {
    const user = await adminAuth.getUserByEmail(email);

    if (user.disabled) return;

    if (!user.emailVerified) {
      await sendVerificationEmail(email, locale);
      return;
    }

    const { delivered } = await sendMail({
      ...buildExistingAccountEmail({
        loginUrl: signupLoginUrl(locale),
        forgotPasswordUrl: forgotPasswordUrl(locale),
        locale,
      }),
      to: email,
    });

    if (!delivered) {
      console.error(
        "Aviso de conta existente não foi entregue: o serviço de envio não está configurado.",
      );
    }
  } catch (error) {
    console.error(
      "Falha ao avisar um cadastro feito com endereço que já tem conta.",
      error instanceof Error ? error.message : error,
    );
  }
}
