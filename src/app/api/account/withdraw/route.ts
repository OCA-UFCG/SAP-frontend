import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { readStoredAccess } from "@/lib/access-claims";
import { readAccessRequest } from "@/lib/access-requests";
import {
  checkAccountPassword,
  deleteAccount,
} from "@/lib/account-management";
import { hasTrustedMutationOrigin } from "@/lib/trusted-origin";
import {
  consumeWithdrawRateLimit,
  getSignupClientKey,
} from "@/app/api/signup/rate-limit";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function reply(code: string, status: number) {
  return NextResponse.json({ code }, { status, headers: NO_STORE });
}

/**
 * Quem está esperando liberação desiste do pedido e apaga os próprios dados.
 *
 * Sem acesso não nasce sessão, então `/api/account/delete` não serve: aqui a
 * pessoa prova quem é com e-mail e senha. A senha é conferida **antes** de
 * dizer qualquer coisa sobre a conta, para a resposta não revelar a quem não
 * sabe a senha se um e-mail se cadastrou.
 *
 * Só vale para pedido pendente de quem nunca teve acesso. O projeto do
 * Firebase é dividido com outros sistemas, e sem um pedido nesta coleção a
 * conta pode ser de outro sistema. Quem já teve o acesso removido também fica
 * de fora: apagar e se cadastrar de novo devolveria o acesso sozinho no trilho
 * institucional.
 */
export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return reply("untrusted_origin", 403);
  }

  if (consumeWithdrawRateLimit(getSignupClientKey(request)).limited) {
    return reply("too_many_attempts", 429);
  }

  let email = "";
  let password = "";
  try {
    const body = (await request.json()) as {
      email?: unknown;
      password?: unknown;
    };
    email = typeof body.email === "string" ? body.email.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return reply("invalid_body", 400);
  }

  if (!email || !password) {
    return reply("wrong_credentials", 401);
  }

  const user = await adminAuth.getUserByEmail(email).catch(() => null);

  // Conta recusada fica desabilitada e o Firebase não confere a senha dela.
  // A resposta é a mesma de senha errada, para não revelar quem foi recusado.
  if (!user?.email || user.disabled) {
    return reply("wrong_credentials", 401);
  }

  const check = await checkAccountPassword(user.uid, user.email, password);

  if (check === "wrong") return reply("wrong_credentials", 401);
  if (check === "too-many-attempts") return reply("too_many_attempts", 429);
  if (check === "failed") return reply("failed", 502);

  const accessRequest = await readAccessRequest(user.uid);

  if (
    accessRequest?.status !== "pending" ||
    readStoredAccess(user.customClaims)
  ) {
    return reply("ask_team", 409);
  }

  try {
    await deleteAccount(user.uid);
  } catch (error) {
    console.error(
      "Falha ao apagar um pedido de acesso a pedido da pessoa.",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return reply("failed", 500);
  }

  return NextResponse.json({ status: "deleted" }, { headers: NO_STORE });
}
