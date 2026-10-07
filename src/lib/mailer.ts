import nodemailer, { type Transporter } from "nodemailer";

/**
 * A única peça que fala com o mundo fora da plataforma.
 *
 * Conta, senha, aprovação e sessão vivem dentro do Firebase e do nosso
 * servidor; daqui saem só três recados: confirme seu endereço, novo pedido de
 * acesso, e sua decisão saiu.
 *
 * O envio é pelo SMTP do Google autenticado com uma senha de aplicativo da
 * conta remetente. O domínio dela já tem SPF e DKIM configurados, então o
 * e-mail chega na caixa de entrada em vez do spam, sem mexer em DNS. Trocar
 * isso por um serviço de envio mexe neste arquivo e em nenhum outro.
 */

const SMTP_HOST = "smtp.gmail.com";
const SMTP_PORT = 465;

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  /** Sempre presente: cliente sem HTML precisa dela, e a falta piora o spam. */
  text: string;
}

let transporter: Transporter | null = null;

export function isMailerConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASSWORD);
}

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });

  return transporter;
}

/** Existe para o teste poder trocar as credenciais entre casos. */
export function resetMailer() {
  transporter = null;
}

/**
 * Escapa texto que veio de fora antes de ele entrar num e-mail HTML.
 *
 * A intenção de uso é a única entrada livre do fluxo e é escrita por um
 * estranho — ela chega ao time como texto, nunca como marcação.
 */
export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sem credencial configurada, registra em log em vez de enviar — é o que mantém
 * o desenvolvimento local funcionando antes de a senha de aplicativo existir.
 *
 * O corpo NÃO vai para o log por padrão: ele carrega o link de confirmação, que
 * é uma credencial e não pode aparecer em log, telemetria ou mensagem de erro.
 * Para depurar localmente, `MAIL_LOG_BODY=true`.
 */
export async function sendMail({ to, subject, html, text }: MailMessage) {
  if (!isMailerConfigured()) {
    // Em desenvolvimento não enviar é o esperado, e o log é informativo. Em
    // produção é falha grave e muda: o cadastro responde sucesso e ninguém
    // nunca recebe nada. Um `info` perdido entre milhares de linhas não avisa
    // ninguém disso.
    const announce =
      process.env.NODE_ENV === "production" ? console.error : console.info;

    announce(
      `[mailer] sem credencial; e-mail NÃO enviado — para: ${to} · assunto: ${subject}`,
    );

    if (process.env.MAIL_LOG_BODY === "true") {
      console.info(`[mailer] corpo:\n${text}`);
    }

    return { delivered: false } as const;
  }

  await getTransporter().sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    text,
  });

  return { delivered: true } as const;
}
