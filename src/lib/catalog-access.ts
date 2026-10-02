import {
  getAuthenticatedUserSession,
  type AuthenticatedUserSession,
} from "@/lib/server-session";
import {
  isAllowedLogsViewerEmail,
  resolveLogsViewerAccess,
} from "@/lib/logs-access";

export type CatalogRequestAccess =
  | {
      allowed: true;
      // A sessão inteira, que é o que `resolveCatalogRequestAccess` já devolvia:
      // o tipo declarava só `uid` e `email` e escondia o resto.
      user: AuthenticatedUserSession;
    }
  | {
      allowed: false;
      status: 401 | 403;
    };

// A regra de origem mora em `trusted-origin`, compartilhada com os logs; o
// export continua aqui para o catálogo e o cadastro não mudarem de import.
export { hasTrustedMutationOrigin } from "@/lib/trusted-origin";

export async function resolveCatalogRequestAccess(
  request: Request,
): Promise<CatalogRequestAccess> {
  const user = await getAuthenticatedUserSession(request);

  if (!user) {
    return { allowed: false, status: 401 };
  }

  if (!isAllowedLogsViewerEmail(user.email)) {
    return { allowed: false, status: 403 };
  }

  return { allowed: true, user };
}

export async function resolveCatalogPageAccess(sessionCookie?: string | null) {
  return resolveLogsViewerAccess(sessionCookie);
}
