import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  addUrlToCache,
  buildCacheKey,
  getCachedUrl,
  hasKey,
} from "@/app/api/ee/cache";
import {
  ensureEeCacheWarmupStarted,
  getEarthEngineUrl,
  getGeeRuntimeDiagnostics,
} from "@/app/api/ee/services";
import { consumeEeRateLimit } from "./rate-limit";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { resolveImageYearEntry } from "@/utils/imageData";
import { getAuthenticatedUserId } from "@/lib/server-session";

function sanitizeDiagnosticText(value: unknown) {
  return String(value)
    .replace(
      /-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/gu,
      "[REDACTED PRIVATE KEY]",
    )
    .replace(/Bearer\s+[^\s"']+/giu, "Bearer [REDACTED]")
    .slice(0, 4_000);
}

function serializeError(error: unknown, depth = 0): Record<string, unknown> {
  if (depth > 3) {
    return { message: "Error cause depth limit reached." };
  }

  if (!(error instanceof Error)) {
    return {
      type: typeof error,
      message: sanitizeDiagnosticText(error),
    };
  }

  const source = error as Error & Record<string, unknown>;
  const diagnostic: Record<string, unknown> = {
    name: error.name,
    message: sanitizeDiagnosticText(error.message),
  };

  for (const property of ["code", "type", "errno", "syscall", "address"]) {
    const value = source[property];
    if (typeof value === "string" || typeof value === "number") {
      diagnostic[property] = sanitizeDiagnosticText(value);
    }
  }

  if (error.stack) {
    diagnostic.stack = sanitizeDiagnosticText(
      error.stack.split("\n").slice(0, 10).join("\n"),
    );
  }

  if (source.cause !== undefined) {
    diagnostic.cause = serializeError(source.cause, depth + 1);
  }

  return diagnostic;
}

async function probeOAuthEndpoint(url: string) {
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "grant_type=diagnostic_invalid",
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    const body = await response.text();

    return {
      url,
      transport: "node-native-fetch",
      completed: true,
      durationMs: Date.now() - startedAt,
      status: response.status,
      statusText: response.statusText,
      responseHeaders: {
        contentType: response.headers.get("content-type"),
        contentLength: response.headers.get("content-length"),
        server: response.headers.get("server"),
        via: response.headers.get("via"),
      },
      bodyPreview: sanitizeDiagnosticText(body).slice(0, 500),
    };
  } catch (error) {
    return {
      url,
      transport: "node-native-fetch",
      completed: false,
      durationMs: Date.now() - startedAt,
      error: serializeError(error),
    };
  }
}

async function runOAuthConnectivityProbes(error: unknown) {
  if (process.env.NODE_ENV === "test") {
    return { skipped: true, reason: "test-environment" };
  }

  const errorText =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (!/oauth2|authentication|premature close|fetcherror/iu.test(errorText)) {
    return { skipped: true, reason: "failure-is-not-oauth-related" };
  }

  const results = await Promise.all([
    probeOAuthEndpoint("https://www.googleapis.com/oauth2/v4/token"),
    probeOAuthEndpoint("https://oauth2.googleapis.com/token"),
  ]);

  return { skipped: false, results };
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const authenticatedUserId = await getAuthenticatedUserId(req);
  if (!authenticatedUserId) {
    return NextResponse.json(
      { error: "Unauthorized access." },
      { status: 401 },
    );
  }

  ensureEeCacheWarmupStarted();

  const rateLimit = consumeEeRateLimit(authenticatedUserId);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many Earth Engine requests. Try again later." },
      {
        status: 429,
        headers: {
          ...rateLimit.headers,
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    const name = req.nextUrl.searchParams.get("name")?.trim() || "";
    const year = req.nextUrl.searchParams.get("year")?.trim() || "";

    if (!name || !year) {
      return NextResponse.json(
        { error: "Missing required query parameters: name and year." },
        { status: 400 },
      );
    }

    const panelLayers = await getPanelLayers();
    const layer = panelLayers.find((item) => item.id === name);

    if (!layer) {
      return NextResponse.json(
        { error: `Layer ${name} not found.` },
        { status: 404 },
      );
    }

    const yearConfig = resolveImageYearEntry(layer.imageData, year);
    if (!yearConfig) {
      return NextResponse.json(
        { error: `Year ${year} not available for layer ${name}.` },
        { status: 404 },
      );
    }

    const cacheKey = buildCacheKey(
      name,
      year,
      yearConfig.imageId,
      yearConfig.imageParams,
      layer.minScale,
      layer.maxScale,
      yearConfig.mapVisualization,
    );

    const urlOnCache = getCachedUrl(cacheKey);
    if (hasKey(cacheKey) && urlOnCache) {
      console.log(new Date().toISOString(), " - Getting URL on cache");
      return NextResponse.json({ url: urlOnCache }, { status: 200 });
    }

    console.log(new Date().toISOString(), " - Starting URL queries");

    const url = await getEarthEngineUrl(
      yearConfig.imageId,
      yearConfig.imageParams,
      layer.minScale,
      layer.maxScale,
      { mapVisualization: yearConfig.mapVisualization },
    );

    console.log(new Date().toISOString(), " - Saving URL to cache");
    addUrlToCache(cacheKey, url);
    console.log(new Date().toISOString(), " - URL saved");

    return NextResponse.json({ url }, { status: 200 });
  } catch (error: any) {
    const oauthConnectivity = await runOAuthConnectivityProbes(error);
    const diagnostics = {
      requestId,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      request: {
        layer: req.nextUrl.searchParams.get("name")?.trim() || null,
        year: req.nextUrl.searchParams.get("year")?.trim() || null,
      },
      gee: getGeeRuntimeDiagnostics(),
      oauthConnectivity,
      error: serializeError(error),
    };

    console.error("[api/ee] Request failed", diagnostics);

    return NextResponse.json(
      { error: error?.message ?? String(error), diagnostics },
      { status: 500, headers: { "X-EE-Request-ID": requestId } },
    );
  }
}
