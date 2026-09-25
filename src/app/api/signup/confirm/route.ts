import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { hasTrustedMutationOrigin } from "@/lib/catalog-access";
import { settleSignup } from "@/lib/signup-settlement";
import {
  consumeConfirmRateLimit,
  getSignupClientKey,
} from "@/app/api/signup/rate-limit";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Fecha o cadastro depois que a pessoa abriu o link do e-mail.
 *
 * O servidor nunca acredita no navegador: a página de confirmação roda no
 * cliente e pode mentir, então quem decide **relê o usuário no Firebase** e
 * confere `emailVerified` na fonte. É essa confirmação que torna a regra de
 * domínio segura — sem ela, qualquer um digitaria o e-mail institucional de
 * outra pessoa e entraria sozinho.
 *
 * O fechamento em si vive em `signup-settlement`, porque o login também precisa
 * dele: quem confirma o endereço e fecha a aba nunca chega aqui.
 */
export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não autorizada." },
      { status: 403, headers: NO_STORE },
    );
  }

  const rateLimit = consumeConfirmRateLimit(getSignupClientKey(request));

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
  try {
    ({ email } = (await request.json()) as { email?: unknown });
  } catch {
    email = null;
  }

  if (typeof email !== "string" || !email.trim()) {
    return notConfirmed();
  }

  const normalizedEmail = email.trim().toLowerCase();

  let user: { uid: string; emailVerified: boolean };
  try {
    user = await adminAuth.getUserByEmail(normalizedEmail);
  } catch {
    // Conta inexistente e endereço não confirmado devolvem a mesma coisa: dizer
    // qual dos dois é transformaria a rota num oráculo de quem tem conta.
    return notConfirmed();
  }

  const settlement = await settleSignup({
    uid: user.uid,
    email: normalizedEmail,
    emailVerified: user.emailVerified,
  });

  if (settlement === "unconfirmed") {
    return notConfirmed();
  }

  return NextResponse.json({ status: settlement }, { headers: NO_STORE });
}

function notConfirmed() {
  return NextResponse.json(
    { error: "Endereço ainda não confirmado." },
    { status: 409, headers: NO_STORE },
  );
}
