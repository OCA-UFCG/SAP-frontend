import { NextResponse } from "next/server";
import { getAuthenticatedUserSession } from "@/lib/server-session";
import {
  LOGS_RATE_LIMIT_MAX_ANONYMOUS_EVENTS,
  LOGS_RATE_LIMIT_MAX_AUTHENTICATED_EVENTS,
  consumeLogsRateLimit,
} from "@/app/api/logs/rate-limit";
import { ingestTelemetryEvents } from "@/services/telemetry/telemetryService";
import {
  parseTelemetryIngestRequest,
  TelemetryValidationError,
} from "@/types/telemetry";

const TRUSTED_SEC_FETCH_SITES = new Set(["same-origin", "none"]);

function hasTrustedTelemetryOrigin(req: Request) {
  const requestOrigin = new URL(req.url).origin;
  const origin = req.headers.get("origin")?.trim();
  const referer = req.headers.get("referer")?.trim();
  const fetchSite = req.headers.get("sec-fetch-site")?.trim().toLowerCase();

  if (fetchSite && !TRUSTED_SEC_FETCH_SITES.has(fetchSite)) {
    return false;
  }

  if (origin && origin !== requestOrigin) {
    return false;
  }

  if (referer) {
    try {
      if (new URL(referer).origin !== requestOrigin) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return Boolean(fetchSite || origin || referer);
}

function getRequestClientKey(req: Request, uid?: string | null) {
  if (uid) {
    return `uid:${uid}`;
  }

  const forwardedFor = req.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  const realIp = req.headers.get("x-real-ip")?.trim();
  const connectingIp = req.headers.get("cf-connecting-ip")?.trim();
  const userAgent = req.headers.get("user-agent")?.trim();

  if (forwardedFor) {
    return `ip:${forwardedFor}`;
  }

  if (realIp) {
    return `ip:${realIp}`;
  }

  if (connectingIp) {
    return `ip:${connectingIp}`;
  }

  return `ua:${userAgent || "unknown"}`;
}

function isFirebaseAdminConfigurationError(error: unknown) {
  const message = error instanceof Error ? error.message : "";

  return (
    message.includes("Firebase Admin credentials are not set") ||
    message.includes("Failed to parse private key") ||
    message.includes("Invalid PEM formatted message")
  );
}

export async function POST(req: Request) {
  if (!hasTrustedTelemetryOrigin(req)) {
    return NextResponse.json(
      { error: "Untrusted logs origin." },
      { status: 403 },
    );
  }

  let payload: unknown;

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const request = parseTelemetryIngestRequest(payload);
    const authenticatedUser = await getAuthenticatedUserSession(req);
    const isAuthenticated = Boolean(authenticatedUser?.uid);
    const rateLimit = consumeLogsRateLimit(
      getRequestClientKey(req, authenticatedUser?.uid ?? null),
      request.events.length,
      isAuthenticated
        ? LOGS_RATE_LIMIT_MAX_AUTHENTICATED_EVENTS
        : LOGS_RATE_LIMIT_MAX_ANONYMOUS_EVENTS,
    );

    if (rateLimit.limited) {
      return NextResponse.json(
        { error: "Too many log events. Try again later." },
        {
          status: 429,
          headers: {
            ...rateLimit.headers,
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const result = await ingestTelemetryEvents(request, {
      uid: authenticatedUser?.uid ?? null,
      userEmail: authenticatedUser?.email ?? null,
    });

    return NextResponse.json(result, {
      status: 202,
      headers: rateLimit.headers,
    });
  } catch (error) {
    if (error instanceof TelemetryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (isFirebaseAdminConfigurationError(error)) {
      return NextResponse.json(
        { error: "Logs service unavailable." },
        { status: 503 },
      );
    }

    console.error("Failed to record log event.", error);

    return NextResponse.json(
      { error: "Failed to record logs." },
      { status: 500 },
    );
  }
}
