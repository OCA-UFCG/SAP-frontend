import { NextResponse } from "next/server";
import { adminAuth } from "@/lib/firebase-admin";
import { hasTrustedMutationOrigin } from "@/lib/catalog-access";
import { resolveSignupTier } from "@/lib/signup-domains";
import { routing } from "@/translations/routing-config";
import {
  createAccessRequest,
  normalizeIntention,
} from "@/lib/access-requests";
import {
  consumeSignupRateLimit,
  getSignupClientKey,
} from "@/app/api/signup/rate-limit";
import { sendVerificationEmail } from "@/lib/signup-verification";

export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Piso local de senha. A regra que vale é a password policy do Firebase Auth,
 * que roda no servidor deles — esta existe para a pessoa receber o erro antes
 * de a conta ser tentada.
 */
const MIN_PASSWORD_LENGTH = 8;

/**
 * Resposta única do cadastro.
 *
 * Os dois trilhos devolvem exatamente isto, e um e-mail que já tem conta também.
 * Qualquer diferença transformaria a rota num oráculo: ou da allowlist de
 * domínios, ou de quem já é usuário da plataforma.
 */
const ACCEPTED_BODY = { status: "accepted" } as const;

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400, headers: NO_STORE });
}

function accepted() {
  return NextResponse.json(ACCEPTED_BODY, { status: 201, headers: NO_STORE });
}

function serverError() {
  return NextResponse.json(
    { error: "Não foi possível concluir o cadastro." },
    { status: 500, headers: NO_STORE },
  );
}

/**
 * Idioma para os e-mails desta pessoa. Vem do navegador, então é validado
 * contra a lista de idiomas do site — um valor qualquer cairia no português.
 */
function resolveEmailLocale(value: unknown) {
  return typeof value === "string" &&
    (routing.locales as readonly string[]).includes(value)
    ? value
    : routing.defaultLocale;
}

function isWellFormedEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isEmailAlreadyTaken(error: unknown) {
  return (error as { code?: string })?.code === "auth/email-already-exists";
}

export async function POST(request: Request) {
  if (!hasTrustedMutationOrigin(request)) {
    return NextResponse.json(
      { error: "Origem da requisição não autorizada." },
      { status: 403, headers: NO_STORE },
    );
  }

  const rateLimit = consumeSignupRateLimit(getSignupClientKey(request));

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

  let body: {
    email?: unknown;
    password?: unknown;
    intention?: unknown;
    locale?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return badRequest("O corpo da requisição deve ser JSON válido.");
  }

  const email =
    typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const locale = resolveEmailLocale(body.locale);

  if (!isWellFormedEmail(email)) {
    return badRequest("Informe um e-mail válido.");
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return badRequest(
      `A senha precisa de pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`,
    );
  }

  // O trilho é recalculado aqui a partir do e-mail. O cliente manda a intenção,
  // nunca o tier: aceitar o tier do cliente deixaria qualquer um se declarar
  // institucional.
  const tier = resolveSignupTier(email);
  const intention = normalizeIntention(body.intention);

  // A intenção é pedida a todo mundo, inclusive a quem entra por domínio
  // autorizado: ela é parte da trilha de auditoria, não só um insumo da decisão
  // manual.
  if (!intention) {
    return badRequest("Descreva como pretende usar a plataforma.");
  }

  let user: { uid: string };

  try {
    // A conta nasce sem o claim de acesso: existir não é entrar. A liberação
    // acontece depois da confirmação de e-mail.
    user = await adminAuth.createUser({
      email,
      password,
      emailVerified: false,
    });
  } catch (error) {
    if (isEmailAlreadyTaken(error)) {
      return accepted();
    }

    console.error("Falha ao criar a conta de cadastro.", error);
    return serverError();
  }

  try {
    // Abre o pedido nos dois trilhos: a trilha de auditoria é por cadastro, não
    // só por aprovação manual.
    await createAccessRequest(user.uid, { email, tier, intention, locale });
  } catch (error) {
    // Sem desfazer, a conta fica órfã — e órfã é pior que inexistente: a pessoa
    // tenta de novo, recebe o mesmo sucesso genérico de "e-mail já existe", e
    // nunca mais consegue abrir um pedido nem receber e-mail. Fica presa vendo
    // telas de sucesso, e a única saída seria um operador apagar a conta na mão.
    console.error("Falha ao registrar o pedido de acesso.", error);
    await adminAuth
      .deleteUser(user.uid)
      .catch((undoError: unknown) =>
        console.error(
          "Falha ao desfazer a conta órfã — ela precisa ser removida à mão.",
          undoError,
        ),
      );

    return serverError();
  }

  // Daqui para baixo o pedido já está registrado. Falha de e-mail não derruba o
  // cadastro: existe o "reenviar" para isso. Mas ela não pode passar calada —
  // sem esta linha, uma configuração errada em produção significa que ninguém
  // nunca se cadastra e a equipe só descobre por reclamação.
  if (!(await sendVerificationEmail(email, locale))) {
    console.error(
      `Cadastro registrado sem e-mail de confirmação entregue (${email}). A pessoa precisa usar o "reenviar".`,
    );
  }

  return accepted();
}
