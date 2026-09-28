import { approveAccess } from "@/lib/access-claims";
import {
  claimTeamNotification,
  createAccessRequest,
  readAccessRequest,
  recordAccessDecision,
} from "@/lib/access-requests";
import { sendMail } from "@/lib/mailer";
import { buildNewRequestEmail } from "@/lib/signup-emails";
import { resolveSignupTier } from "@/lib/signup-domains";
import { routing } from "@/translations/routing-config";
import { approvalsUrl } from "@/lib/signup-urls";

export type SignupSettlement =
  | "approved"
  | "pending"
  | "rejected"
  | "unconfirmed";

/**
 * Fecha um cadastro cujo endereço já foi confirmado.
 *
 * Vive fora das rotas porque **dois caminhos** precisam dela, e só um era
 * óbvio. O primeiro é a página de confirmação, logo depois do clique no link.
 * O segundo é o login: quem confirma o endereço e fecha a aba na tela do
 * Firebase nunca chega na nossa página — e, sem isto, ficaria pendente para
 * sempre, inclusive no trilho institucional, que deveria ser automático.
 *
 * Nada aqui confia no navegador: quem chama já leu `emailVerified` do Firebase,
 * e o trilho é sempre recalculado a partir do e-mail.
 */
export async function settleSignup({
  uid,
  email,
  emailVerified,
}: {
  uid: string;
  email: string;
  emailVerified: boolean;
}): Promise<SignupSettlement> {
  if (!emailVerified) {
    return "unconfirmed";
  }

  let accessRequest = await readAccessRequest(uid);

  // Conta existe, endereço confirmado, e nenhum pedido registrado: é o beco sem
  // saída de quem passou por uma falha no meio do cadastro. A pessoa não
  // consegue se cadastrar de novo (o e-mail já existe) nem avançar, então o
  // pedido que faltou é aberto agora. A intenção se perdeu junto com o
  // cadastro, e o trilho comum continua passando pela decisão do OCA — que é
  // quem pode pedir o contexto que falta.
  if (!accessRequest) {
    console.warn(
      `Pedido de acesso ausente para uma conta confirmada (${uid}); abrindo agora.`,
    );

    await createAccessRequest(uid, {
      email,
      tier: resolveSignupTier(email),
      intention: "",
      // O idioma original se perdeu junto com o cadastro; o padrão do site é o
      // melhor palpite disponível.
      locale: routing.defaultLocale,
    });

    accessRequest = await readAccessRequest(uid);
  }

  if (!accessRequest) {
    return "unconfirmed";
  }

  if (accessRequest.status !== "pending") {
    return accessRequest.status;
  }

  if (accessRequest.tier === "allowed") {
    await approveAccess(uid, "allowed");
    // A regra de domínio decidiu, não um operador — e isso fica na trilha.
    await recordAccessDecision(uid, { status: "approved", decidedBy: null });

    return "approved";
  }

  await notifyTeam(uid, accessRequest.email, accessRequest.intention);

  return "pending";
}

/**
 * Avisa a equipe, uma vez só.
 *
 * A reserva vem antes do envio: é ela que faz duas aberturas simultâneas do
 * link virarem um aviso só. Ela fica de pé mesmo se o envio falhar — o pedido
 * continua visível na tela de aprovação, e repetir o aviso a cada clique seria
 * pior que perdê-lo uma vez.
 */
async function notifyTeam(uid: string, email: string, intention: string) {
  const to = process.env.OCA_NOTIFICATION_EMAIL;

  if (!to) {
    console.error(
      "OCA_NOTIFICATION_EMAIL não configurado: pedido de acesso registrado sem aviso por e-mail.",
    );
    return;
  }

  if (!(await claimTeamNotification(uid))) {
    return;
  }

  try {
    await sendMail({
      ...buildNewRequestEmail({ email, intention, approvalUrl: approvalsUrl() }),
      to,
    });
  } catch (error) {
    console.error(
      "Falha ao avisar a equipe sobre um pedido de acesso.",
      error instanceof Error ? error.message : "erro desconhecido",
    );
  }
}
