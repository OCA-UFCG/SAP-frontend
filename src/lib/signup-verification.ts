import { adminAuth } from "@/lib/firebase-admin";
import { sendMail } from "@/lib/mailer";
import { buildVerificationEmail } from "@/lib/signup-emails";
import { signupConfirmationUrl } from "@/lib/signup-urls";

/**
 * Descreve a falha sem carregar o link junto.
 *
 * O link de confirmação é uma credencial e não pode aparecer em log, telemetria
 * nem mensagem de erro. Mensagens de bibliotecas de envio às vezes ecoam o
 * conteúdo que tentaram mandar, então registrar `error.message` cru vaza o
 * segredo pela porta dos fundos. Aqui o link é apagado antes.
 */
function describeWithoutLink(error: unknown, link?: string) {
  const message =
    error instanceof Error ? error.message : "erro desconhecido";

  return link ? message.split(link).join("[link omitido]") : message;
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
  let link: string | undefined;

  try {
    // O endereço viaja no link de retorno para a página saber quem confirmar,
    // em vez de depender do que o Firebase anexa por conta própria. Não é
    // credencial: o servidor relê `emailVerified` no Firebase antes de liberar
    // qualquer coisa.
    link = await adminAuth.generateEmailVerificationLink(email, {
      url: `${signupConfirmationUrl()}?email=${encodeURIComponent(email)}`,
      handleCodeInApp: false,
    });

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
      describeWithoutLink(error, link),
    );
    return false;
  }
}
