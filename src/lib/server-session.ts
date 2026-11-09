import { adminAuth } from "@/lib/firebase-admin";
import {
  hasApprovedAccess,
  readAccessClaim,
  readStoredAccess,
  REVOKED_ACCESS,
  type AccessClaim,
} from "@/lib/access-claims";
import { isAccessGuardEnabled, isPlatformOpen } from "@/lib/access-flag";
import {
  getVerifiedSession,
  rememberVerifiedSession,
} from "@/lib/verified-session-cache";
import { getClientAddress } from "@/utils/rateLimitStore";

import {
  SESSION_COOKIE_NAME,
  VISITOR_COOKIE_NAME,
} from "@/config/accessRoutes";

export { SESSION_COOKIE_NAME };
export const SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;
export const SESSION_COOKIE_MAX_AGE_MS = SESSION_COOKIE_MAX_AGE_SECONDS * 1000;

export interface AuthenticatedUserSession {
  uid: string;
  email: string | null;
  // Liberação de acesso, lida do claim que o token já carrega. Não custa
  // chamada nenhuma: é mais um campo do que `verifySessionCookie` devolve.
  access: AccessClaim | null;
}

function normalizeSessionEmail(email: unknown) {
  if (typeof email !== "string") {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  return normalizedEmail || null;
}

export type SessionCreation =
  | { status: "created"; sessionCookie: string }
  | {
      status: "unapproved";
      /**
       * Quem foi recusado. Existe para o chamador poder tentar fechar um
       * cadastro que ficou pendente — quem confirma o endereço e fecha a aba
       * nunca volta à página de confirmação, e sem isto ficaria de fora para
       * sempre, inclusive no trilho institucional.
       */
      uid: string;
      email: string | null;
      emailVerified: boolean;
      /**
       * A equipe tirou o acesso. Quem chega aqui não está esperando nada, e a
       * página de espera precisa dizer isso em vez de "cadastro em análise".
       */
      revoked: boolean;
    };

/**
 * Abre a sessão da plataforma — e é aqui que o acesso é barrado.
 *
 * O bloqueio vive num ponto só, e é este: sem a marca de liberação na conta não
 * nasce cookie, e sem cookie não há plataforma. O guard do layout continua
 * existindo para os cookies emitidos antes de a flag ser ligada, mas quem
 * decide é esta função.
 *
 * O token é verificado uma vez só. Conferir o claim com uma segunda chamada
 * custaria outra ida ao Identity Toolkit (~330 ms) em todo login — é o mesmo
 * custo que o `verified-session-cache` existe para evitar.
 */
export async function createFirebaseSessionCookie(
  token: string,
): Promise<SessionCreation> {
  const decodedToken = await adminAuth.verifyIdToken(token);

  if (isAccessGuardEnabled() && !hasApprovedAccess(decodedToken)) {
    return {
      status: "unapproved",
      uid: decodedToken.uid,
      email: normalizeSessionEmail(decodedToken.email),
      emailVerified: Boolean(decodedToken.email_verified),
      revoked: readStoredAccess(decodedToken)?.access === REVOKED_ACCESS,
    };
  }

  const sessionCookie = await adminAuth.createSessionCookie(token, {
    expiresIn: SESSION_COOKIE_MAX_AGE_MS,
  });

  return { status: "created", sessionCookie };
}

/**
 * Resolve a sessão de um cookie, servindo do cache de sessões verificadas quando
 * possível. Toda entrada da plataforma passa por aqui, então é o único ponto que
 * fala com o Firebase Admin para autenticar um request.
 */
async function resolveSessionFromCookie(
  sessionCookie: string | null,
): Promise<AuthenticatedUserSession | null> {
  if (!sessionCookie) return null;

  const cachedSession = getVerifiedSession(sessionCookie);
  if (cachedSession) return cachedSession;

  try {
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    );
    const session = {
      uid: decodedToken.uid,
      email: normalizeSessionEmail(decodedToken.email),
      access: readAccessClaim(decodedToken),
    };

    rememberVerifiedSession(sessionCookie, session, decodedToken.exp * 1000);
    return session;
  } catch {
    return null;
  }
}

/**
 * Sessão autenticada a partir do cookie em si, servida do cache de sessões
 * verificadas. Existe para as páginas de servidor, que leem o cookie por
 * `cookies()` e não têm um `Request` para entregar a
 * `getAuthenticatedUserSession`. Sem ela cada página refaz a ida ao Identity
 * Toolkit que o layout da plataforma já pagou no mesmo request.
 *
 * const session = await getAuthenticatedSessionFromCookie(sessionCookie);
 */
export async function getAuthenticatedSessionFromCookie(
  sessionCookie?: string | null,
): Promise<AuthenticatedUserSession | null> {
  return resolveSessionFromCookie(sessionCookie ?? null);
}

export async function verifyFirebaseSessionCookie(
  sessionCookie?: string | null,
) {
  return Boolean(await getAuthenticatedSessionFromCookie(sessionCookie));
}

export async function getAuthenticatedUserSession(
  request: Request,
): Promise<AuthenticatedUserSession | null> {
  return resolveSessionFromCookie(getSessionCookieFromRequest(request));
}

export async function getAuthenticatedUserId(request: Request) {
  const session = await getAuthenticatedUserSession(request);
  return session?.uid ?? null;
}

export function getCookieValue(
  cookieHeader: string | null,
  cookieName: string,
) {
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`));

  if (!cookie) return null;

  return decodeURIComponent(cookie.slice(cookieName.length + 1));
}

export function getSessionCookieFromRequest(request: Request) {
  return getCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
}

const VISITOR_ID_PATTERN = /^[0-9a-f-]{36}$/;

/**
 * Chave de quem fez a requisição, para os limites de uso das rotas de mapa e
 * de análise. `null` quando a pessoa não pode usar a plataforma.
 *
 * Com login, é o usuário. Na plataforma aberta, sem login, é o navegador
 * (cookie que o middleware grava) ou, sem ele, o endereço de rede. O cookie
 * existe porque numa apresentação a sala inteira sai pelo mesmo endereço, e
 * uma cota só para todos barraria a análise da quinta pessoa em diante.
 *
 * const requesterKey = await getPlatformRequesterKey(request);
 * if (!requesterKey) return 401;
 */
export async function getPlatformRequesterKey(request: Request) {
  const userId = await getAuthenticatedUserId(request);
  if (userId) return userId;
  if (!isPlatformOpen()) return null;

  const visitorId = getCookieValue(
    request.headers.get("cookie"),
    VISITOR_COOKIE_NAME,
  );
  if (visitorId && VISITOR_ID_PATTERN.test(visitorId)) {
    return `visitor:${visitorId}`;
  }

  return `ip:${getClientAddress(request) ?? "unknown"}`;
}

/**
 * Porteiro das rotas de dados.
 *
 * Checa autenticação **e** liberação. A segunda parte importa porque o guard
 * das páginas só protege HTML: um cookie emitido antes de o bloqueio ser
 * ligado continua válido, é barrado nas telas, e antes disto continuava
 * servindo para chamar as rotas de dados direto.
 *
 * Na plataforma aberta deixa todo mundo passar, com ou sem login.
 */
export async function requireAuthenticatedRequest(request: Request) {
  if (isPlatformOpen()) return null;

  const session = await getAuthenticatedUserSession(request);

  if (!session) {
    return Response.json({ error: "Unauthorized access." }, { status: 401 });
  }

  if (isAccessGuardEnabled() && !session.access) {
    return Response.json({ error: "Access not granted." }, { status: 403 });
  }

  return null;
}
