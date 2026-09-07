import { getAuthenticatedSessionFromCookie } from "@/lib/server-session";

export type LogsViewerAccess = "allowed" | "forbidden" | "unauthenticated";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function parseAllowedLogsViewerEmails(
  value = process.env.LOGS_ALLOWED_EMAILS,
) {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => normalizeEmail(entry)),
  );
}

/**
 * Decide se um e-mail já autenticado está na allowlist. A lista é lida do
 * ambiente a cada chamada de propósito: tirar alguém de `LOGS_ALLOWED_EMAILS`
 * passa a valer no request seguinte, sem esperar cache nenhum.
 *
 * isAllowedLogsViewerEmail(session.email);
 */
export function isAllowedLogsViewerEmail(email?: string | null) {
  const allowedEmails = parseAllowedLogsViewerEmails();

  if (!email || allowedEmails.size === 0) {
    return false;
  }

  return allowedEmails.has(normalizeEmail(email));
}

/**
 * Acesso do visitante às telas de auditoria e catálogo.
 *
 * O e-mail vem do claim da sessão, resolvido pelo cache de sessões verificadas
 * (`verified-session-cache`) que o layout da plataforma já preencheu no mesmo
 * request. É a mesma fonte que `resolveCatalogRequestAccess` usa para liberar as
 * mutações do catálogo, o guard mais estrito do projeto.
 *
 * O `adminAuth.getUser` que ficava aqui era uma segunda ida ao Identity Toolkit
 * (~300 ms) repetida em toda renderização de página da plataforma, e lia o mesmo
 * e-mail que o cookie já carrega.
 */
export async function resolveLogsViewerAccess(
  sessionCookie?: string | null,
): Promise<LogsViewerAccess> {
  if (!sessionCookie) {
    return "unauthenticated";
  }

  const session = await getAuthenticatedSessionFromCookie(sessionCookie);

  if (!session) {
    return "unauthenticated";
  }

  return isAllowedLogsViewerEmail(session.email) ? "allowed" : "forbidden";
}
