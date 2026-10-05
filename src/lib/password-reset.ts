import { adminAuth } from "@/lib/firebase-admin";
import { sendMail } from "@/lib/mailer";
import { buildPasswordResetEmail } from "@/lib/signup-emails";
import { extractVerificationCode } from "@/lib/email-verification-code";
import { describeWithoutLink } from "@/lib/signup-verification";
import { passwordResetUrl } from "@/lib/signup-urls";

/** Firebase responde assim quando não há conta com o endereço. */
function isUnknownAccount(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === "auth/user-not-found" || code === "auth/email-not-found";
}

/**
 * Manda o link de troca de senha e diz se ele saiu.
 *
 * Endereço sem conta não é erro: quem chama responde igual de qualquer forma,
 * e registrar cada tentativa só encheria o log com o que um curioso digitou.
 */
export async function sendPasswordResetEmail(email: string, locale?: string) {
  let code: string | null = null;

  try {
    // Procura a conta antes de gerar o link. Com a proteção contra enumeração
    // de e-mails ligada no projeto, o Firebase não diz "conta inexistente" ao
    // gerar o link: devolve um link vazio, e o Admin SDK transforma isso num
    // `auth/internal-error` igual a qualquer falha de verdade. Aqui a ausência
    // da conta chega com o nome certo.
    await adminAuth.getUserByEmail(email);

    // Como na confirmação de endereço, do link do Firebase só sai o código: a
    // pessoa troca a senha na nossa página, no idioma em que pediu.
    code = extractVerificationCode(
      await adminAuth.generatePasswordResetLink(email),
    );

    if (!code) {
      throw new Error("O Firebase devolveu um link sem código de troca de senha.");
    }

    const link = `${passwordResetUrl(locale)}?${new URLSearchParams({ code })}`;

    const { delivered } = await sendMail({
      ...buildPasswordResetEmail({ link, locale }),
      to: email,
    });

    if (!delivered) {
      console.error(
        "E-mail de troca de senha não foi entregue: o serviço de envio não está configurado.",
      );
    }

    return delivered;
  } catch (error) {
    if (isUnknownAccount(error)) return false;

    console.error(
      "Falha ao enviar o e-mail de troca de senha.",
      describeWithoutLink(error, code),
    );
    return false;
  }
}
