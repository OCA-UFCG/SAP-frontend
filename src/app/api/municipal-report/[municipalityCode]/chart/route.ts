import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import { getMunicipalAnalysisCacheControlHeader } from "@/repositories/platform/municipalAnalysisCache";
import { buildMunicipalReport, MunicipalReportNotFoundError } from "@/services/municipalReportService";
import {
  renderMunicipalReportCharts,
  resolveMunicipalReportChartAnalyses,
} from "@/services/municipalReportChartService";

const MUNICIPALITY_CODE_PATTERN = /^\d{7}$/u;
const PERIOD_PATTERN = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/u;

function error(message: string, status: number) {
  return NextResponse.json({ error: message }, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * GET /api/municipal-report/{municipalityCode}/chart?period=YYYY-MM&analysis=seca,aridez
 *
 * Returns base64-encoded SVG chart images for the requested analyses.
 */
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
  const analysisParam = url.searchParams.get("analysis")?.trim();

  if (!MUNICIPALITY_CODE_PATTERN.test(code)) return error("Invalid municipality code.", 400);
  if (!period || !PERIOD_PATTERN.test(period)) return error("Invalid or missing period.", 400);
  if (!analysisParam) return error("Missing 'analysis' query parameter. Provide one or more analysis IDs or aliases separated by commas.", 400);

  const requestedIds = analysisParam.split(",").map((id) => id.trim().toLowerCase()).filter(Boolean);
  if (requestedIds.length === 0) return error("No valid analysis IDs provided.", 400);

  try {
    const report = await buildMunicipalReport(code, period);

    const { missingAnalyses, availableAnalyses } =
      resolveMunicipalReportChartAnalyses(report, requestedIds);

    if (missingAnalyses.length === requestedIds.length) {
      return error(`No matching analyses found for: ${missingAnalyses.join(", ")}`, 404);
    }
    if (availableAnalyses.length === 0) {
      return error("No available time-series data for the requested analyses.", 404);
    }

    const charts = await renderMunicipalReportCharts(availableAnalyses, period);

    return NextResponse.json(
      { municipality: report.municipality, requestedPeriod: period, charts },
      { headers: { "Cache-Control": getMunicipalAnalysisCacheControlHeader() } },
    );
  } catch (cause) {
    if (cause instanceof MunicipalReportNotFoundError) return error(cause.message, 404);
    console.error("Erro ao gerar gráfico do relatório municipal:", cause);
    return error("Unable to generate municipal report chart.", 502);
  }
}
