import { getAuthenticatedSessionFromCookie } from "@/lib/server-session";
import { isAccessGuardEnabled } from "@/lib/access-flag";

export type PlatformAccess = "approved" | "unapproved" | "unauthenticated";

export { PENDING_APPROVAL_PATH } from "@/config/accessRoutes";

/**
 * Acesso do visitante à plataforma.
 *
 * Rede de segurança, não o bloqueio principal: quem decide é
 * `createFirebaseSessionCookie`, que recusa abrir sessão sem a marca. Este
 * guard existe para os cookies emitidos **antes** de a flag ser ligada — eles
 * são válidos e não carregam claim nenhum.
 *
 * O e-mail e o claim vêm da sessão já resolvida pelo cache de sessões
 * verificadas, a mesma fonte que `resolveLogsViewerAccess` usa. Nenhuma ida
 * extra ao Identity Toolkit: o claim viaja dentro do token que o cookie já
 * carrega.
 *
 * const access = await resolvePlatformAccess(sessionCookie);
 */
export async function resolvePlatformAccess(
  sessionCookie?: string | null,
): Promise<PlatformAccess> {
  if (!sessionCookie) {
    return "unauthenticated";
  }

  const session = await getAuthenticatedSessionFromCookie(sessionCookie);

  if (!session) {
    return "unauthenticated";
  }

  if (!isAccessGuardEnabled()) {
    return "approved";
  }

  return session.access ? "approved" : "unapproved";
}
