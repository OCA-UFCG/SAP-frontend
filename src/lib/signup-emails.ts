import { escapeHtml, type MailMessage } from "@/lib/mailer";
import ptMessages from "@/translations/pt/SignupEmails.json";
import enMessages from "@/translations/en/SignupEmails.json";
import esMessages from "@/translations/es/SignupEmails.json";

/**
 * As mensagens vivem em `src/translations/<idioma>/SignupEmails.json`, onde
 * quem traduz o resto do site já procura. São importadas estaticamente, e não
 * pelo carregador do next-intl, porque um e-mail é despachado fora do contexto
 * de uma requisição — não existe "idioma atual" para consultar.
 */
const MESSAGES = {
  pt: ptMessages.SignupEmails,
  en: enMessages.SignupEmails,
  es: esMessages.SignupEmails,
} as const;

type EmailLocale = keyof typeof MESSAGES;

/**
 * Idioma desconhecido cai no português em vez de virar e-mail vazio: perder o
 * idioma é um incômodo, perder a mensagem inteira impede a pessoa de entrar.
 */
function messagesFor(locale: string | undefined) {
  return MESSAGES[(locale ?? "pt") as EmailLocale] ?? MESSAGES.pt;
}

/**
 * Os três recados que saem da plataforma.
 *
 * Regras que valem para todos, e que existem por motivo, não por estilo:
 *
 * - **CSS inline.** Cliente de e-mail descarta folha de estilo; o que não
 *   estiver no atributo `style` não é aplicado.
 * - **Nenhuma imagem essencial.** Boa parte das caixas bloqueia imagem por
 *   padrão — um e-mail que depende dela chega quebrado.
 * - **A URL escrita por extenso abaixo do botão.** Quem não vê o botão, ou
 *   desconfia dele, precisa poder ler e copiar o endereço.
 * - **Texto puro junto do HTML.** Cliente sem HTML precisa dele, e a ausência
 *   também piora a pontuação de spam.
 */

const INK = "#21240F";
const MUTED = "#50554C";
const ACCENT = "#777E32";
const BORDER = "#DBE0CC";

function layout(title: string, body: string, footer: string) {
  return [
    `<div style="margin:0;padding:24px;background:#F3F5EE;font-family:Helvetica,Arial,sans-serif;color:${INK};">`,
    `<div style="max-width:520px;margin:0 auto;padding:28px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:6px;">`,
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${INK};">${title}</h1>`,
    body,
    `<p style="margin:28px 0 0;padding-top:16px;border-top:1px solid ${BORDER};font-size:12px;line-height:1.5;color:${MUTED};">${footer}</p>`,
    `</div></div>`,
  ].join("");
}

function paragraph(content: string) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:${MUTED};">${content}</p>`;
}

/** Botão mais a URL por extenso logo abaixo — nunca só o botão. */
function callToAction(label: string, url: string, fallbackLabel: string) {
  return [
    `<p style="margin:22px 0 10px;">`,
    `<a href="${url}" style="display:inline-block;padding:10px 18px;background:${ACCENT};color:#FFFFFF;font-size:14px;text-decoration:none;border-radius:5px;">${label}</a>`,
    `</p>`,
    `<p style="margin:0;font-size:12px;line-height:1.5;color:${MUTED};word-break:break-all;">${fallbackLabel}<br>${url}</p>`,
  ].join("");
}

export function buildVerificationEmail({
  link,
  locale,
}: {
  link: string;
  locale?: string;
}): Omit<MailMessage, "to"> {
  const m = messagesFor(locale);

  return {
    subject: m.verificationSubject,
    html: layout(
      m.verificationTitle,
      paragraph(m.verificationBody) +
        callToAction(m.verificationAction, link, m.fallback),
      m.footer,
    ),
    text: [
      m.verificationTitle,
      "",
      m.verificationBody,
      "",
      link,
      "",
      m.footer,
    ].join("\n"),
  };
}

/**
 * Vai para a caixa da equipe, sempre em português: o destinatário é o time, não
 * quem se cadastrou.
 */
export function buildNewRequestEmail({
  email,
  intention,
  approvalUrl,
}: {
  email: string;
  intention: string;
  approvalUrl: string;
}): Omit<MailMessage, "to"> {
  const safeEmail = escapeHtml(email);
  const safeIntention = escapeHtml(intention);

  return {
    subject: "Novo pedido de acesso ao SAP",
    html: layout(
      "Novo pedido de acesso",
      paragraph(`<strong>${safeEmail}</strong> confirmou o endereço e aguarda liberação.`) +
        paragraph("Intenção de uso descrita no cadastro:") +
        `<blockquote style="margin:0 0 14px;padding:12px 14px;background:#F3F5EE;border-left:3px solid ${ACCENT};font-size:14px;line-height:1.55;color:${INK};white-space:pre-wrap;">${safeIntention}</blockquote>` +
        callToAction(
          "Abrir a tela de aprovação",
          approvalUrl,
          MESSAGES.pt.fallback,
        ),
      MESSAGES.pt.footer,
    ),
    text: [
      "Novo pedido de acesso",
      "",
      `${email} confirmou o endereço e aguarda liberação.`,
      "",
      "Intenção de uso descrita no cadastro:",
      intention,
      "",
      "Decida na tela de aprovação:",
      approvalUrl,
      "",
      "Sistema de Alerta Precoce — SEDES",
    ].join("\n"),
  };
}

export function buildAccessDecisionEmail({
  status,
  loginUrl,
  locale,
}: {
  status: "approved" | "rejected";
  loginUrl: string;
  locale?: string;
}): Omit<MailMessage, "to"> {
  const m = messagesFor(locale);

  if (status === "approved") {
    return {
      subject: m.decisionApprovedSubject,
      html: layout(
        m.decisionApprovedTitle,
        paragraph(m.decisionApprovedBody) +
          callToAction(m.decisionApprovedAction, loginUrl, m.fallback),
        m.footer,
      ),
      text: [
        m.decisionApprovedTitle,
        "",
        m.decisionApprovedBody,
        "",
        loginUrl,
        "",
        m.footer,
      ].join("\n"),
    };
  }

  // Sem link de login: apontar para uma porta que não abre é pior que não
  // apontar para nenhuma.
  return {
    subject: m.decisionRejectedSubject,
    html: layout(
      m.decisionRejectedTitle,
      paragraph(m.decisionRejectedBody) + paragraph(m.decisionRejectedFollowUp),
      m.footer,
    ),
    text: [
      m.decisionRejectedTitle,
      "",
      m.decisionRejectedBody,
      "",
      m.decisionRejectedFollowUp,
      "",
      m.footer,
    ].join("\n"),
  };
}
