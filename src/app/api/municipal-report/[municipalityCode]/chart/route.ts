import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import { getMunicipalAnalysisCacheControlHeader } from "@/repositories/platform/municipalAnalysisCache";
import {
  buildMunicipalReport,
  MunicipalReportNotFoundError,
} from "@/services/municipalReportService";
import {
  renderMunicipalReportCharts,
  resolveMunicipalReportChartAnalyses,
} from "@/services/municipalReportChartService";
import { createServerTiming } from "@/utils/serverTiming";

const MUNICIPALITY_CODE_PATTERN = /^\d{7}$/u;
const PERIOD_PATTERN = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/u;
const CHART_CACHE_TTL_MS = 10 * 60 * 1000;
const CHART_CACHE_MAX_ITEMS = 80;

interface MunicipalReportChartResponse {
  municipality: Awaited<
    ReturnType<typeof buildMunicipalReport>
  >["municipality"];
  requestedPeriod: string;
  charts: Awaited<ReturnType<typeof renderMunicipalReportCharts>>;
}

const chartCache = new Map<
  string,
  { expiresAt: number; payload: MunicipalReportChartResponse }
>();

function error(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function getChartCacheKey(
  code: string,
  period: string,
  requestedIds: string[],
) {
  return [code, period, [...requestedIds].sort().join(",")].join(":");
}

function readChartCache(key: string) {
  const cached = chartCache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    chartCache.delete(key);
    return null;
  }
  return cached.payload;
}

function writeChartCache(key: string, payload: MunicipalReportChartResponse) {
  if (chartCache.size >= CHART_CACHE_MAX_ITEMS) {
    const oldestKey = chartCache.keys().next().value;
    if (oldestKey) chartCache.delete(oldestKey);
  }

  chartCache.set(key, {
    expiresAt: Date.now() + CHART_CACHE_TTL_MS,
    payload,
  });
}

/**
 * GET /api/municipal-report/{municipalityCode}/chart?period=YYYY-MM&analysis=seca,aridez
 *
 * Returns base64-encoded SVG chart images for the requested analyses.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ municipalityCode: string }> },
) {
  const timing = createServerTiming();
  const finishAuth = timing.start();
  const unauthorized = await requireAuthenticatedRequest(request);
  finishAuth("auth", "Autenticação");
  if (unauthorized) {
    unauthorized.headers.set("Cache-Control", "no-store");
    unauthorized.headers.set("Server-Timing", timing.header());
    return unauthorized;
  }

  const { municipalityCode } = await context.params;
  const code = decodeURIComponent(municipalityCode).trim();
  const url = new URL(request.url);
  const period = url.searchParams.get("period")?.trim();
  const analysisParam = url.searchParams.get("analysis")?.trim();

  if (!MUNICIPALITY_CODE_PATTERN.test(code))
    return error("Invalid municipality code.", 400);
  if (!period || !PERIOD_PATTERN.test(period))
    return error("Invalid or missing period.", 400);
  if (!analysisParam)
    return error(
      "Missing 'analysis' query parameter. Provide one or more analysis IDs or aliases separated by commas.",
      400,
    );

  const requestedIds = analysisParam
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
  if (requestedIds.length === 0)
    return error("No valid analysis IDs provided.", 400);

  try {
    const finishCacheLookup = timing.start();
    const cacheKey = getChartCacheKey(code, period, requestedIds);
    const cached = readChartCache(cacheKey);
    finishCacheLookup("cache_lookup", cached ? "Cache de gráficos: hit" : "Cache de gráficos: miss");
    if (cached) {
      return NextResponse.json(cached, {
        headers: {
          "Cache-Control": getMunicipalAnalysisCacheControlHeader(),
          "Server-Timing": timing.header(),
        },
      });
    }

    // Avoid rebuilding every report layer for a chart request that only needs
    // the explicitly selected analyses.
    const finishBuild = timing.start();
    const report = await buildMunicipalReport(code, period, {
      analysisIds: requestedIds,
      onTiming: timing.record,
    });
    finishBuild("build_report", "Montagem dos dados dos gráficos");

    const { missingAnalyses, availableAnalyses } =
      resolveMunicipalReportChartAnalyses(report, requestedIds);

    if (missingAnalyses.length === requestedIds.length) {
      return error(
        `No matching analyses found for: ${missingAnalyses.join(", ")}`,
        404,
      );
    }
    if (availableAnalyses.length === 0) {
      return error(
        "No available time-series data for the requested analyses.",
        404,
      );
    }

    const finishRender = timing.start();
    const charts = await renderMunicipalReportCharts(availableAnalyses, period);
    finishRender("render_charts", "Renderização dos SVGs");
    const payload = {
      municipality: report.municipality,
      requestedPeriod: period,
      charts,
    };
    writeChartCache(cacheKey, payload);

    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": getMunicipalAnalysisCacheControlHeader(),
        "Server-Timing": timing.header(),
      },
    });
  } catch (cause) {
    if (cause instanceof MunicipalReportNotFoundError)
      return error(cause.message, 404);
    console.error("Erro ao gerar gráfico do relatório municipal:", cause);
    return error("Unable to generate municipal report chart.", 502);
  }
}
