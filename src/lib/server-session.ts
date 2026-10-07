import { adminAuth } from "@/lib/firebase-admin";
import {
  hasApprovedAccess,
  readAccessClaim,
  type AccessClaim,
} from "@/lib/access-claims";
import { isAccessGuardEnabled } from "@/lib/access-flag";
import {
  getVerifiedSession,
  rememberVerifiedSession,
} from "@/lib/verified-session-cache";

export const SESSION_COOKIE_NAME = "session";
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

/**
 * Porteiro das rotas de dados.
 *
 * Checa autenticação **e** liberação. A segunda parte importa porque o guard
 * das páginas só protege HTML: um cookie emitido antes de o bloqueio ser
 * ligado continua válido, é barrado nas telas, e antes disto continuava
 * servindo para chamar as rotas de dados direto.
 */
export async function requireAuthenticatedRequest(request: Request) {
  const session = await getAuthenticatedUserSession(request);

  if (!session) {
    return Response.json({ error: "Unauthorized access." }, { status: 401 });
  }

  if (isAccessGuardEnabled() && !session.access) {
    return Response.json({ error: "Access not granted." }, { status: 403 });
  }

  return null;
}
