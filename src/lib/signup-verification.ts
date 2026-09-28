import { adminAuth } from "@/lib/firebase-admin";
import { sendMail } from "@/lib/mailer";
import { buildVerificationEmail } from "@/lib/signup-emails";
import { extractVerificationCode } from "@/lib/email-verification-code";
import { signupConfirmationUrl } from "@/lib/signup-urls";

/**
 * Descreve a falha sem carregar o link junto.
 *
 * O link de confirmação é uma credencial e não pode aparecer em log, telemetria
 * nem mensagem de erro. Mensagens de bibliotecas de envio às vezes ecoam o
 * conteúdo que tentaram mandar, então registrar `error.message` cru vaza o
 * segredo pela porta dos fundos. Aqui o código que vai no link é apagado antes.
 */
function describeWithoutLink(error: unknown, code: string | null) {
  const message =
    error instanceof Error ? error.message : "erro desconhecido";

  // Apaga o código, e não o link inteiro: no corpo em HTML o link aparece com
  // `&amp;` no lugar de `&`, e uma busca pelo link exato deixaria passar.
  return code ? message.split(code).join("[código omitido]") : message;
}

/**
 * Manda o e-mail de confirmação e diz, com honestidade, se ele saiu.
 *
 * Quando isto roda no cadastro, o pedido já está registrado. Derrubar o
 * cadastro porque o servidor de e-mail caiu perderia o registro de alguém que
 * fez tudo certo — e existe o "reenviar e-mail" exatamente para esse caso. Por
 * isso a falha não é lançada; é devolvida, para quem chama decidir o que fazer.
 */
export async function sendVerificationEmail(email: string, locale?: string) {
  let code: string | null = null;

  try {
    // O e-mail leva a pessoa para a nossa página, e não para a do Firebase: só
    // o código de uso único sai do link que ele gera. Sem `actionCodeSettings`,
    // o Firebase também não exige que o nosso domínio esteja na lista de
    // domínios autorizados dele.
    //
    // O endereço vai junto para a página poder oferecer o "reenviar" quando o
    // código já venceu. Não é credencial: o servidor relê `emailVerified` no
    // Firebase antes de liberar qualquer coisa.
    code = extractVerificationCode(
      await adminAuth.generateEmailVerificationLink(email),
    );

    if (!code) {
      throw new Error("O Firebase devolveu um link sem código de confirmação.");
    }

    const query = new URLSearchParams({ code, email });
    const link = `${signupConfirmationUrl(locale)}?${query}`;

    const { delivered } = await sendMail({
      ...buildVerificationEmail({ link, locale }),
      to: email,
    });

    if (!delivered) {
      // Sem credencial configurada o envio não acontece, e antes isto devolvia
      // sucesso: o cadastro respondia "confira seu e-mail" e nada nunca chegava.
      console.error(
        "E-mail de confirmação não foi entregue: o serviço de envio não está configurado.",
      );
    }

    return delivered;
  } catch (error) {
    console.error(
      "Falha ao enviar o e-mail de confirmação.",
      describeWithoutLink(error, code),
    );
    return false;
  }
}
