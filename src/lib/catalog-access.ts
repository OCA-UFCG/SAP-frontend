import {
  getAuthenticatedUserSession,
  type AuthenticatedUserSession,
} from "@/lib/server-session";
import {
  isAllowedLogsViewerSession,
  resolveLogsViewerAccess,
} from "@/lib/logs-access";

export type CatalogRequestAccess =
  | {
      allowed: true;
      user: AuthenticatedUserSession;
    }
  | {
      allowed: false;
      status: 401 | 403;
    };

export function hasTrustedMutationOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  const configuredHost = process.env.NEXT_PUBLIC_HOST_URL;
  const trustedOrigins = new Set([requestUrl.origin]);

  if (configuredHost) {
    try {
      trustedOrigins.add(new URL(configuredHost).origin);
    } catch {
      return false;
    }
  }

  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }

  for (const value of [origin, referer]) {
    if (!value) continue;

    try {
      if (!trustedOrigins.has(new URL(value).origin)) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return Boolean(fetchSite || origin || referer);
}

export async function resolveCatalogRequestAccess(
  request: Request,
): Promise<CatalogRequestAccess> {
  const user = await getAuthenticatedUserSession(request);

  if (!user) {
    return { allowed: false, status: 401 };
  }

  if (!isAllowedLogsViewerSession(user)) {
    return { allowed: false, status: 403 };
  }

  return { allowed: true, user };
}

export async function resolveCatalogPageAccess(sessionCookie?: string | null) {
  return resolveLogsViewerAccess(sessionCookie);
}
