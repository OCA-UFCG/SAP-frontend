import { NextResponse } from "next/server";
import { hasTrustedMutationOrigin } from "@/lib/catalog-access";
import { rejectWhenSignupClosed } from "@/app/api/signup/availability";
import { sendVerificationEmail } from "@/lib/signup-verification";
import { VERIFICATION_EMAIL_COOLDOWN_SECONDS } from "@/config/verificationEmailCooldown";
import {
  consumeResendRateLimit,
  consumeVerificationEmailCooldown,
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
 *
 * A exceção é a espera entre dois envios para o mesmo endereço, que responde
 * 429 com quanto falta. Ela vale para qualquer endereço, cadastrado ou não, e
 * existe porque o Firebase recusa o link novo antes de um minuto: aceitar o
 * pedido ali era responder "enviado" para um e-mail que nunca saía.
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
    const normalizedEmail = email.trim().toLowerCase();
    const cooldown = consumeVerificationEmailCooldown(normalizedEmail);

    if (cooldown.limited) {
      return tooSoon(cooldown.retryAfterSeconds);
    }

    // A espera daqui é maior que a do Firebase, então isto só acontece se ela
    // perdeu a conta — o servidor reiniciou, por exemplo. Só conta com
    // cadastro chega aqui, mas a resposta é a mesma da espera acima.
    if ((await sendVerificationEmail(normalizedEmail)) === "throttled") {
      return tooSoon(VERIFICATION_EMAIL_COOLDOWN_SECONDS);
    }
  }

  return NextResponse.json(
    { status: "accepted" },
    { status: 202, headers: NO_STORE },
  );
}

function tooSoon(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: "Enviamos um email há pouco. Aguarde para pedir outro." },
    {
      status: 429,
      headers: { ...NO_STORE, "Retry-After": String(retryAfterSeconds) },
    },
  );
}
