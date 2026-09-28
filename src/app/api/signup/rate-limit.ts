import { createRateLimitStore } from "@/utils/rateLimitStore";

const RATE_LIMIT_WINDOW_MS = 1000 * 60;

/**
 * Um orçamento por ação, não um compartilhado entre todas.
 *
 * O cadastro acontece antes de existir sessão, então a chave é o endereço de
 * rede — e uma repartição inteira costuma sair para a internet com um endereço
 * só. Com um balde único entre cadastro, confirmação e reenvio, a terceira
 * pessoa do mesmo prédio era barrada por causa das duas colegas que se
 * cadastraram antes dela, que é exatamente o público deste sistema.
 *
 * Os tetos seguem o custo real de cada ação:
 */

/** Cria conta no Firebase E dispara e-mail. Cabe um treinamento inteiro se cadastrando junto. */
export const SIGNUP_RATE_LIMIT_MAX_REQUESTS = 20;

/** Dispara e-mail a cada chamada: o mais apertado dos três. */
export const RESEND_RATE_LIMIT_MAX_REQUESTS = 10;

/**
 * Só lê e decide. Precisa da maior folga: programas de e-mail abrem os links
 * das mensagens sozinhos para checar segurança, em paralelo com o clique.
 */
export const CONFIRM_RATE_LIMIT_MAX_REQUESTS = 40;

const signupRequests = createRateLimitStore();
const resendRequests = createRateLimitStore();
const confirmRequests = createRateLimitStore();

/**
 * Chave de cliente de uma requisição não autenticada, na mesma ordem de
 * cabeçalhos que `api/logs/route.ts` já usa.
 *
 * A última saída é o user-agent, não uma chave fixa: um balde único para o
 * mundo inteiro seria um jeito trivial de derrubar o cadastro — bastaria
 * alguém gastar as tentativas uma vez por minuto. Cair nele também significa
 * que o proxy não está repassando o endereço, que é problema de infraestrutura
 * e precisa aparecer no log.
 */
export function getSignupClientKey(request: Request) {
  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();
  const connectingIp = request.headers.get("cf-connecting-ip")?.trim();

  const address = forwardedFor || realIp || connectingIp;

  if (address) {
    return `ip:${address}`;
  }

  console.error(
    "Nenhum cabeçalho de endereço na requisição de cadastro: o limite de tentativas está caindo para o user-agent. Confira se o proxy repassa x-forwarded-for.",
  );

  return `ua:${request.headers.get("user-agent")?.trim() || "desconhecido"}`;
}

function consume(
  store: ReturnType<typeof createRateLimitStore>,
  clientKey: string,
  maxRequests: number,
) {
  const now = Date.now();
  const current = store.get(clientKey, now);
  const entry = current
    ? { count: current.count + 1, resetAt: current.resetAt }
    : { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };

  store.set(clientKey, entry, now);

  return {
    limited: entry.count > maxRequests,
    retryAfterSeconds: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

export function consumeSignupRateLimit(clientKey: string) {
  return consume(signupRequests, clientKey, SIGNUP_RATE_LIMIT_MAX_REQUESTS);
}

export function consumeResendRateLimit(clientKey: string) {
  return consume(resendRequests, clientKey, RESEND_RATE_LIMIT_MAX_REQUESTS);
}

export function consumeConfirmRateLimit(clientKey: string) {
  return consume(confirmRequests, clientKey, CONFIRM_RATE_LIMIT_MAX_REQUESTS);
}

export function clearSignupRateLimits() {
  signupRequests.clear();
  resendRequests.clear();
  confirmRequests.clear();
}

export { RATE_LIMIT_WINDOW_MS as SIGNUP_RATE_LIMIT_WINDOW_MS };
