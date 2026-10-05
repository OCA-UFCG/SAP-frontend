import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { MIN_PASSWORD_LENGTH } from "@/config/passwordRules";
import { resetPasswordWithCode } from "@/lib/password-reset-code";
import {
  NO_STORE,
  failure,
  readBody,
  rejectCodeRequest,
} from "@/app/api/password-reset/code-request";

export const runtime = "nodejs";

/**
 * Troca a senha com o código do link.
 *
 * O Firebase já invalida as sessões abertas quando a senha muda. A revogação
 * aqui é a mesma de `approveAccess`: explícita, para não depender de um detalhe
 * do Firebase justo no caso em que a senha antiga pode estar com outra pessoa.
 */
export async function POST(request: Request) {
  const rejected = rejectCodeRequest(request);
  if (rejected) return rejected;

  const { code, password } = await readBody(request);

  if (typeof code !== "string" || !code) {
    return failure("invalid-code", 410);
  }

  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    return failure("weak-password", 400);
  }

  const result = await resetPasswordWithCode(code, password);

  if (result.status === "invalid-code") return failure("invalid-code", 410);
  if (result.status === "weak-password") return failure("weak-password", 400);
  if (result.status === "failed") return failure("failed", 502);

  try {
    const user = await adminAuth.getUserByEmail(result.email);
    await adminAuth.revokeRefreshTokens(user.uid);
  } catch {
    // A senha já mudou, e o Firebase já invalidou os tokens por conta própria.
    // Falhar aqui não pode virar "não foi possível trocar a senha".
    console.error(
      "Senha trocada, mas a revogação explícita das sessões falhou.",
    );
  }

  return NextResponse.json({ status: "changed" }, { headers: NO_STORE });
}
