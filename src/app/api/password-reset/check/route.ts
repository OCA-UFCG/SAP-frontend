import { NextResponse } from "next/server";
import { checkPasswordResetCode } from "@/lib/password-reset-code";
import {
  NO_STORE,
  failure,
  readBody,
  rejectCodeRequest,
} from "@/app/api/password-reset/code-request";

export const runtime = "nodejs";

/**
 * Confere o código do link antes de a pessoa digitar a senha nova, para um link
 * vencido aparecer como tal na hora, e não só depois do formulário preenchido.
 *
 * Devolver o e-mail não abre oráculo: só quem tem o código recebe resposta, e o
 * código só chega à caixa de entrada da própria conta.
 */
export async function POST(request: Request) {
  const rejected = rejectCodeRequest(request);
  if (rejected) return rejected;

  const { code } = await readBody(request);

  const email =
    typeof code === "string" && code ? await checkPasswordResetCode(code) : null;

  if (!email) return failure("invalid-code", 410);

  return NextResponse.json({ email }, { headers: NO_STORE });
}
