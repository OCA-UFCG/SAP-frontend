import { createHash } from "node:crypto";
import type { AuthenticatedUserSession } from "@/lib/server-session";

// `verifySessionCookie(cookie, true)` não valida o cookie offline: o
// checkRevoked faz o Firebase Admin buscar o usuário no Identity Toolkit para
// comparar `tokensValidAfterTime`, medido em ~330 ms de round-trip. Toda rota da
// plataforma faz isso antes de qualquer trabalho, então uma única intervenção no
// mapa paga esse custo várias vezes. Guardar a sessão já verificada por uma
// janela curta troca a ida à rede por um lookup em memória.
//
// A contrapartida é explícita: dentro da janela, uma conta revogada ou
// desabilitada continua sendo aceita naquele processo. A expiração do próprio
// cookie nunca é estendida (ver rememberVerifiedSession).
const DEFAULT_TTL_MS = 60_000;
// Uma entrada por sessão ativa. O teto existe para um pico de logins não fazer o
// mapa crescer sem limite, não por consumo de memória.
const DEFAULT_MAX_ENTRIES = 5000;

interface VerifiedSessionEntry {
  expiresAt: number;
  session: AuthenticatedUserSession;
}

const verifiedSessions = new Map<string, VerifiedSessionEntry>();

function readCacheTtlMs(): number {
  const seconds = Number(process.env.SESSION_VERIFICATION_CACHE_TTL_SECONDS);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    return DEFAULT_TTL_MS;
  }

  return Math.floor(seconds) * 1000;
}

// O cookie de sessão é uma credencial: só o digest fica retido no processo.
function buildSessionCacheKey(sessionCookie: string): string {
  return createHash("sha256").update(sessionCookie).digest("hex");
}

// Map preserva ordem de inserção: reinserir a chave lida deixa a menos
// recentemente usada em primeiro lugar, o que torna a evicção O(1).
function markAsRecentlyUsed(key: string, entry: VerifiedSessionEntry) {
  verifiedSessions.delete(key);
  verifiedSessions.set(key, entry);
}

function evictLeastRecentlyUsed() {
  while (verifiedSessions.size > DEFAULT_MAX_ENTRIES) {
    const { value: oldestKey } = verifiedSessions.keys().next();

    if (oldestKey === undefined) {
      return;
    }

    verifiedSessions.delete(oldestKey);
  }
}

/**
 * Sessão já verificada para esse cookie, ou null quando não há nada válido em
 * cache e a verificação precisa ir ao Firebase.
 *
 * const cached = getVerifiedSession(sessionCookie);
 */
export function getVerifiedSession(
  sessionCookie: string,
): AuthenticatedUserSession | null {
  const key = buildSessionCacheKey(sessionCookie);
  const entry = verifiedSessions.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    verifiedSessions.delete(key);
    return null;
  }

  markAsRecentlyUsed(key, entry);
  return entry.session;
}

/**
 * Guarda uma sessão recém-verificada. `sessionExpiresAtMs` é o `exp` do token em
 * milissegundos: a janela do cache é o que vier primeiro entre ele e o TTL, para
 * um cookie expirado nunca continuar valendo por vir do cache.
 *
 * rememberVerifiedSession(cookie, session, decodedToken.exp * 1000);
 */
export function rememberVerifiedSession(
  sessionCookie: string,
  session: AuthenticatedUserSession,
  sessionExpiresAtMs: number,
) {
  // Sem um `exp` utilizável não há como limitar a entrada à validade do token,
  // e um Math.min com NaN produziria uma entrada que nunca expira. Nesse caso a
  // sessão simplesmente não entra no cache e cada request revalida.
  if (!Number.isFinite(sessionExpiresAtMs)) {
    return;
  }

  const now = Date.now();
  const expiresAt = Math.min(now + readCacheTtlMs(), sessionExpiresAtMs);

  if (expiresAt <= now) {
    return;
  }

  markAsRecentlyUsed(buildSessionCacheKey(sessionCookie), {
    expiresAt,
    session,
  });
  evictLeastRecentlyUsed();
}

/**
 * Descarta as sessões verificadas. Usado pelos testes e por qualquer fluxo que
 * precise forçar uma revalidação imediata contra o Firebase.
 */
export function clearVerifiedSessionCache() {
  verifiedSessions.clear();
}
