import { adminAuth } from "@/lib/firebase-admin";
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
}

function normalizeSessionEmail(email: unknown) {
  if (typeof email !== "string") {
    return null;
  }

  const normalizedEmail = email.trim().toLowerCase();
  return normalizedEmail || null;
}

export async function createFirebaseSessionCookie(token: string) {
  await adminAuth.verifyIdToken(token);

  return adminAuth.createSessionCookie(token, {
    expiresIn: SESSION_COOKIE_MAX_AGE_MS,
  });
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
    };

    rememberVerifiedSession(sessionCookie, session, decodedToken.exp * 1000);
    return session;
  } catch {
    return null;
  }
}

export async function verifyFirebaseSessionCookie(
  sessionCookie?: string | null,
) {
  return Boolean(await resolveSessionFromCookie(sessionCookie ?? null));
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

export async function requireAuthenticatedRequest(request: Request) {
  const isAuthenticated = await verifyFirebaseSessionCookie(
    getSessionCookieFromRequest(request),
  );

  if (isAuthenticated) return null;

  return Response.json({ error: "Unauthorized access." }, { status: 401 });
}
