import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { hasTrustedMutationOrigin } from "@/lib/catalog-access";
import { rejectWhenSignupClosed } from "@/app/api/signup/availability";
import { settleSignup } from "@/lib/signup-settlement";
import { applyVerificationCode } from "@/lib/email-verification-code";
import {
  consumeConfirmRateLimit,
  getSignupClientKey,
} from "@/app/api/signup/rate-limit";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Fecha o cadastro depois que a pessoa abriu o link do e-mail.
 *
 * O link traz o código de confirmação do Firebase, e é aqui que ele é aplicado
 * — a pessoa nunca passa pela página do Firebase.
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
  const closed = rejectWhenSignupClosed();
  if (closed) return closed;

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
  let code: unknown;
  try {
    ({ email, code } = (await request.json()) as {
      email?: unknown;
      code?: unknown;
    });
  } catch {
    email = null;
  }

  // O código do e-mail é o que confirma o endereço. Quando ele vale, o e-mail
  // que conta é o que o Firebase diz ter confirmado, não o que veio no link.
  // Quando não vale (já usado, vencido), segue com o endereço do link: quem abre
  // o e-mail pela segunda vez já está confirmado e só precisa da resposta.
  const confirmedEmail =
    typeof code === "string" && code
      ? await applyVerificationCode(code)
      : null;

  if (confirmedEmail) {
    email = confirmedEmail;
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
