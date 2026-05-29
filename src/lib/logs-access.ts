import { adminAuth } from "@/lib/firebase-admin";

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

export async function resolveLogsViewerAccess(
  sessionCookie?: string | null,
): Promise<LogsViewerAccess> {
  if (!sessionCookie) {
    return "unauthenticated";
  }

  try {
    const decodedToken = await adminAuth.verifySessionCookie(
      sessionCookie,
      true,
    );
    const user = await adminAuth.getUser(decodedToken.uid);
    const allowedEmails = parseAllowedLogsViewerEmails();
    const email = user.email ? normalizeEmail(user.email) : null;

    if (!email || allowedEmails.size === 0) {
      return "forbidden";
    }

    return allowedEmails.has(email) ? "allowed" : "forbidden";
  } catch {
    return "unauthenticated";
  }
}
