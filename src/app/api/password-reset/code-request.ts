import { NextResponse } from "next/server";
import { hasTrustedMutationOrigin } from "@/lib/catalog-access";
import {
  consumePasswordResetCodeRateLimit,
  getSignupClientKey,
} from "@/app/api/signup/rate-limit";

export const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Motivos que a página de troca de senha sabe mostrar. Vão no corpo como
 * `reason`, e não como texto, porque a mensagem é traduzida no navegador.
 */
export type PasswordResetFailure = "invalid-code" | "weak-password" | "failed";

export function failure(reason: PasswordResetFailure, status: number) {
  return NextResponse.json({ reason }, { status, headers: NO_STORE });
}

/**
 * A porta comum de `check` e `confirm`: origem confiável e limite por endereço.
 * Devolve a resposta de recusa, ou `null` para seguir.
 */
export function rejectCodeRequest(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não autorizada." },
      { status: 403, headers: NO_STORE },
    );
  }

  const rateLimit = consumePasswordResetCodeRateLimit(
    getSignupClientKey(request),
  );

  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Muitas tentativas. Tente novamente em instantes." },
      {
        status: 429,
        headers: {
          ...NO_STORE,
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  return null;
}

/** Lê o corpo sem lançar: JSON quebrado vira objeto vazio. */
export async function readBody(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown> | null;
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}
