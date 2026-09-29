import { after, NextResponse } from "next/server";
import { hasTrustedMutationOrigin } from "@/lib/catalog-access";
import { resolveEmailLocale } from "@/lib/email-locale";
import { sendPasswordResetEmail } from "@/lib/password-reset";
import {
  consumePasswordResetRequestRateLimit,
  getSignupClientKey,
} from "@/app/api/signup/rate-limit";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * "Esqueci minha senha": manda o link de troca para o endereço informado.
 *
 * Não depende do bloqueio de acesso, ao contrário das rotas de cadastro: trocar
 * a senha não cria conta, e quem tem conta feita à mão também esquece a senha.
 *
 * A resposta é sempre a mesma — endereço com conta, sem conta ou mal digitado
 * devolvem o mesmo corpo. Esta é a porta mais óbvia para descobrir quem é
 * usuário da plataforma, e só fica fechada se nunca responder diferente.
 */
export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não autorizada." },
      { status: 403, headers: NO_STORE },
    );
  }

  const rateLimit = consumePasswordResetRequestRateLimit(
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

  let email: unknown;
  let locale: unknown;
  try {
    ({ email, locale } = (await request.json()) as {
      email?: unknown;
      locale?: unknown;
    });
  } catch {
    email = null;
  }

  if (typeof email === "string" && email.trim()) {
    const address = email.trim().toLowerCase();
    const emailLocale = resolveEmailLocale(locale);

    // Depois da resposta: gerar o link e falar com o SMTP leva tempo, e só
    // acontece quando a conta existe. Esperar por isso deixaria o relógio
    // contar o que o corpo da resposta esconde.
    after(() => sendPasswordResetEmail(address, emailLocale));
  }

  return NextResponse.json(
    { status: "accepted" },
    { status: 202, headers: NO_STORE },
  );
}
