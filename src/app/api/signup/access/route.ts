import { NextResponse } from "next/server";
import { requireCatalogAccess } from "@/app/api/index-catalog/http";
import { adminAuth } from "@/lib/firebase-admin";
import {
  approveAccess,
  readStoredAccess,
  revokeAccess,
  REVOKED_ACCESS,
} from "@/lib/access-claims";
import { recordAccessChange } from "@/lib/access-requests";
import { deleteAccount } from "@/lib/account-management";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

const ACTIONS = ["revoke", "restore", "delete"] as const;
type Action = (typeof ACTIONS)[number];

function isAction(value: unknown): value is Action {
  return ACTIONS.includes(value as Action);
}

function reply(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: NO_STORE });
}

/**
 * O que a equipe faz com quem já tem conta: remover o acesso, devolver o acesso
 * removido, ou excluir a conta. Antes disto, as três coisas só eram possíveis
 * pelo painel do Firebase.
 *
 * Mesma proteção da aprovação de pedidos: allowlist de operadores, checagem de
 * origem, e a identidade de quem decidiu vem da sessão, nunca da tela.
 */
export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, { mutation: true });

  if ("response" in access) {
    return access.response;
  }

  let body: { uid?: unknown; action?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return reply("O corpo da requisição deve ser JSON válido.", 400);
  }

  const uid = typeof body.uid === "string" ? body.uid.trim() : "";

  if (!uid || !isAction(body.action)) {
    return reply("Informe o usuário e uma ação válida.", 400);
  }

  // Um operador que remove o próprio acesso ou apaga a própria conta perde a
  // tela em que desfaria isso. Se for mesmo o caso, outro operador faz.
  if (uid === access.user.uid) {
    return reply("Não dá para fazer isso com a sua própria conta.", 409);
  }

  let user;
  try {
    user = await adminAuth.getUser(uid);
  } catch {
    return reply("Conta não encontrada.", 404);
  }

  const action = body.action;
  const stored = readStoredAccess(user.customClaims);
  const decidedBy = access.user.email;

  if (action === "delete") {
    await deleteAccount(uid);
    return NextResponse.json({ status: "deleted" }, { headers: NO_STORE });
  }

  if (action === "restore") {
    if (stored?.access !== REVOKED_ACCESS) {
      return reply("Esta conta não está com o acesso removido.", 409);
    }

    // A trilha vem antes do acesso, como na aprovação: se algo falhar no meio,
    // sobra um registro sem efeito (visível, e repetir resolve), nunca um
    // acesso sem registro.
    await recordAccessChange(uid, {
      status: "approved",
      email: user.email ?? "",
      tier: stored.tier,
      decidedBy,
    });
    await approveAccess(uid, stored.tier);

    return NextResponse.json({ status: "approved" }, { headers: NO_STORE });
  }

  // A trilha também vem antes aqui, e neste caso ela é parte da trava: uma
  // conta antiga, de domínio autorizado e sem registro, seria liberada de novo
  // no próximo login (`settleSignup`) se só o claim mudasse.
  await recordAccessChange(uid, {
    status: "revoked",
    email: user.email ?? "",
    tier: stored?.tier ?? "legacy",
    decidedBy,
  });
  await revokeAccess(uid);

  return NextResponse.json({ status: "revoked" }, { headers: NO_STORE });
}
