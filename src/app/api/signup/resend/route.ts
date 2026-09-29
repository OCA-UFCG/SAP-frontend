import { NextResponse } from "next/server";
import { hasTrustedMutationOrigin } from "@/lib/catalog-access";
import { sendVerificationEmail } from "@/lib/signup-verification";
import {
  consumeResendRateLimit,
  getSignupClientIp,
  getSignupClientKey,
} from "@/app/api/signup/rate-limit";
import { CAPTCHA_FAILED_MESSAGE, verifyCaptcha } from "@/lib/captcha";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Reenvia o e-mail de confirmação.
 *
 * Precisa existir sempre: o link expira, o envio pode falhar, e o e-mail pode
 * simplesmente cair no spam. Sem esta porta, a única saída de quem não recebeu
 * é abrir chamado com a equipe.
 *
 * A resposta é sempre a mesma — endereço cadastrado, desconhecido ou já
 * confirmado devolvem o mesmo corpo. Reenviar é justamente o tipo de porta que
 * vira oráculo de quem tem conta se responder coisas diferentes.
 */
export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não autorizada." },
      { status: 403, headers: NO_STORE },
    );
  }

  const rateLimit = consumeResendRateLimit(getSignupClientKey(request));

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
  let captchaToken: string | undefined;
  try {
    ({ email, captchaToken } = (await request.json()) as {
      email?: unknown;
      captchaToken?: string;
    });
  } catch {
    email = null;
  }

  // Reenviar manda e-mail para qualquer endereço: sem captcha, é a porta mais
  // fácil para esgotar a cota de envio da equipe.
  if (
    !(await verifyCaptcha(
      typeof captchaToken === "string" ? captchaToken : "",
      { action: "resend", remoteIp: getSignupClientIp(request) },
    ))
  ) {
    return NextResponse.json(
      { error: CAPTCHA_FAILED_MESSAGE },
      { status: 400, headers: NO_STORE },
    );
  }

  if (typeof email === "string" && email.trim()) {
    await sendVerificationEmail(email.trim().toLowerCase());
  }

  return NextResponse.json({ status: "accepted" }, { status: 202, headers: NO_STORE });
}
