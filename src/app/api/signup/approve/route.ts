import { NextResponse } from "next/server";
import { requireCatalogAccess } from "@/app/api/index-catalog/http";
import { adminAuth } from "@/lib/firebase-admin";
import { approveAccess } from "@/lib/access-claims";
import {
  claimPendingDecision,
  readAccessRequest,
  type AccessRequestStatus,
} from "@/lib/access-requests";
import { sendMail } from "@/lib/mailer";
import { buildAccessDecisionEmail } from "@/lib/signup-emails";
import { loginUrl } from "@/lib/signup-urls";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

type Decision = Exclude<AccessRequestStatus, "pending">;

function isDecision(value: unknown): value is Decision {
  return value === "approved" || value === "rejected";
}

/**
 * Decisão do operador sobre um pedido de acesso.
 *
 * Passa pela proteção mais estrita do projeto, a mesma do catálogo de índices, e
 * como mutação — aprovar acesso é mais sensível que publicar um índice. Isso
 * traz junto a checagem de origem e a allowlist de operadores, e é de lá que sai
 * a identidade de quem decidiu.
 */
export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, { mutation: true });

  if ("response" in access) {
    return access.response;
  }

  let body: { uid?: unknown; decision?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { error: "O corpo da requisição deve ser JSON válido." },
      { status: 400, headers: NO_STORE },
    );
  }

  const uid = typeof body.uid === "string" ? body.uid.trim() : "";

  if (!uid || !isDecision(body.decision)) {
    return NextResponse.json(
      { error: "Informe o usuário e uma decisão válida." },
      { status: 400, headers: NO_STORE },
    );
  }

  const decision = body.decision;
  const accessRequest = await readAccessRequest(uid);

  if (!accessRequest) {
    return NextResponse.json(
      { error: "Pedido de acesso não encontrado." },
      { status: 404, headers: NO_STORE },
    );
  }

  // Duas pessoas podem abrir a tela ao mesmo tempo. A transação é o que faz o
  // segundo a chegar desistir de verdade — sem ela, os dois passavam, e um
  // aprovando enquanto o outro recusa deixava a pessoa com acesso e a trilha
  // dizendo que foi negada.
  //
  // A decisão é gravada ANTES de o acesso ser concedido, de propósito: se algo
  // falhar no meio, sobra um pedido decidido sem acesso concedido (visível,
  // recuperável) em vez de acesso concedido sem registro (invisível, e a
  // auditoria mentindo).
  const claim = await claimPendingDecision(uid, {
    status: decision,
    decidedBy: access.user.email,
  });

  if (!claim.claimed) {
    return NextResponse.json(
      { error: "Este pedido já foi decidido.", status: claim.status },
      { status: 409, headers: NO_STORE },
    );
  }

  if (decision === "approved") {
    // O tier vem do que a transação leu do cadastro, não do que a tela mandou.
    await approveAccess(uid, claim.tier);
  } else {
    // Sem isto, quem foi recusado mantém conta ativa e fica tentando entrar
    // para sempre — e o e-mail dele continua ocupado, então nem um novo
    // cadastro resolve. Desabilitar fecha as duas pontas e é reversível pelo
    // painel do Firebase.
    await adminAuth
      .updateUser(uid, { disabled: true })
      .catch((error: unknown) =>
        console.error(
          "Pedido recusado, mas a conta continua habilitada.",
          error instanceof Error ? error.message : "erro desconhecido",
        ),
      );
  }

  await notifyApplicant(accessRequest.email, decision, accessRequest.locale);

  return NextResponse.json({ status: decision }, { headers: NO_STORE });
}

/**
 * Fecha o ciclo com quem pediu.
 *
 * O aviso de recusa fica desligado por padrão: a equipe ainda não decidiu se
 * quer enviá-lo, e avisar por engano é pior que não avisar. `SIGNUP_SEND_REJECTION_EMAIL=true`
 * liga quando decidirem.
 */
async function notifyApplicant(
  email: string,
  decision: Decision,
  locale: string | undefined,
) {
  if (decision === "rejected" && process.env.SIGNUP_SEND_REJECTION_EMAIL !== "true") {
    return;
  }

  try {
    await sendMail({
      ...buildAccessDecisionEmail({
        status: decision,
        loginUrl: loginUrl(),
        locale,
      }),
      to: email,
    });
  } catch (error) {
    // A decisão já está gravada. Falhar o request faria o operador decidir de
    // novo um pedido que já foi decidido.
    console.error(
      "Falha ao avisar a pessoa sobre a decisão de acesso.",
      error instanceof Error ? error.message : "erro desconhecido",
    );
  }
}
