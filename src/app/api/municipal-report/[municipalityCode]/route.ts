import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import { getMunicipalAnalysisCacheControlHeader } from "@/repositories/platform/municipalAnalysisCache";
import { buildMunicipalReport, MunicipalReportNotFoundError } from "@/services/municipalReportService";

const MUNICIPALITY_CODE_PATTERN = /^\d{7}$/u;
const PERIOD_PATTERN = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/u;
const LAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/u;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request, context: { params: Promise<{ municipalityCode: string }> }) {
  const unauthorized = await requireAuthenticatedRequest(request);
  if (unauthorized) {
    unauthorized.headers.set("Cache-Control", "no-store");
    return unauthorized;
  }
  const { municipalityCode } = await context.params;
  const code = decodeURIComponent(municipalityCode).trim();
  const url = new URL(request.url);
  const period = url.searchParams.get("period")?.trim();
  const layers = url.searchParams.get("layers")
    ?.split(",")
    .map((layer) => layer.trim())
    .filter((layer) => LAYER_ID_PATTERN.test(layer));
  if (!MUNICIPALITY_CODE_PATTERN.test(code)) return error("Invalid municipality code.", 400);
  if (!period || !PERIOD_PATTERN.test(period)) return error("Invalid or missing period.", 400);

  try {
    const report = await buildMunicipalReport(code, period, {
      ...(layers?.length ? { analysisIds: layers } : {}),
    });
    if (
      !report.analyses.some((analysis) => analysis.status !== "unavailable")
    ) {
      return error("Unable to build any municipal report analysis.", 502);
    }
    return NextResponse.json(report, { headers: { "Cache-Control": getMunicipalAnalysisCacheControlHeader() } });
  } catch (cause) {
    if (cause instanceof MunicipalReportNotFoundError) return error(cause.message, 404);
    console.error("Erro ao montar relatório municipal:", cause);
    return error("Unable to build municipal report.", 502);
  }
}
