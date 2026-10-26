import { NextResponse } from "next/server";
import {
  getAuthenticatedUserSession,
  SESSION_COOKIE_NAME,
} from "@/lib/server-session";
import { hasTrustedMutationOrigin } from "@/lib/trusted-origin";
import {
  checkAccountPassword,
  deleteAccount,
} from "@/lib/account-management";
import { canDeleteOwnAccount } from "@/lib/account-deletion-policy";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

function reply(code: string, status: number) {
  return NextResponse.json({ code }, { status, headers: NO_STORE });
}

/**
 * A pessoa exclui a própria conta.
 *
 * Exige a sessão **e** a senha de novo (ver `checkAccountPassword`). Contas
 * antigas, de antes do cadastro, ficam de fora: algumas são usadas por mais de
 * uma pessoa, de outros órgãos, e quem apagasse uma delas tiraria o acesso de
 * todo mundo que a usa. Para essas, o caminho é pedir à equipe, que exclui pela
 * tela de Aprovações.
 */
export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return reply("untrusted_origin", 403);
  }

  const session = await getAuthenticatedUserSession(request);

  if (!session?.email) {
    return reply("unauthenticated", 401);
  }

  if (!canDeleteOwnAccount(session.access)) {
    return reply("ask_team", 403);
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return reply("invalid_body", 400);
  }

  if (!password) {
    return reply("wrong_password", 401);
  }

  const check = await checkAccountPassword(
    session.uid,
    session.email,
    password,
  );

  if (check === "wrong") return reply("wrong_password", 401);
  if (check === "too-many-attempts") return reply("too_many_attempts", 429);
  if (check === "failed") return reply("failed", 502);

  try {
    await deleteAccount(session.uid);
  } catch (error) {
    console.error(
      "Falha ao excluir a conta a pedido da pessoa.",
      error instanceof Error ? error.message : "erro desconhecido",
    );
    return reply("failed", 500);
  }

  const response = NextResponse.json(
    { status: "deleted" },
    { headers: NO_STORE },
  );

  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
