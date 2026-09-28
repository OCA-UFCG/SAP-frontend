import { NextResponse } from "next/server";
import { isSignupOffered } from "@/lib/access-flag";

/**
 * Fecha as rotas de cadastro enquanto o bloqueio de acesso estiver desligado.
 *
 * Esconder o link no login não bastava: `/api/signup` continuava criando conta
 * para quem chamasse a rota direto, e com o bloqueio desligado a sessão nasce
 * sem conferir a marca nem o e-mail confirmado — a conta recém-criada entrava na
 * plataforma na hora. Pior, o backfill marcaria essas contas como `legacy`.
 * Responder 404 aqui é o que torna "desligado" igual a "como era antes".
 *
 * const closed = rejectWhenSignupClosed();
 * if (closed) return closed;
 */
export function rejectWhenSignupClosed() {
  if (isSignupOffered()) return null;

  return NextResponse.json(
    { error: "Not found." },
    { status: 404, headers: { "Cache-Control": "no-store" } },
  );
}
