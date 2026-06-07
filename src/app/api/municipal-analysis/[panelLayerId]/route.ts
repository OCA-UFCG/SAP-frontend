import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import {
  getCachedMunicipalAnalysisImageData,
  getMunicipalAnalysisCacheControlHeader,
} from "@/repositories/platform/municipalAnalysisCache";

interface MunicipalAnalysisRouteContext {
  params: Promise<{
    panelLayerId: string;
  }>;
}

const PANEL_LAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/u;
const YEAR_KEY_PATTERN = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/u;

function isValidPanelLayerId(value: string) {
  return PANEL_LAYER_ID_PATTERN.test(value);
}

function isValidYearKey(value: string) {
  return YEAR_KEY_PATTERN.test(value);
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function GET(
  request: Request,
  context: MunicipalAnalysisRouteContext,
) {
  const unauthorizedResponse = await requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    unauthorizedResponse.headers.set("Cache-Control", "no-store");
    return unauthorizedResponse;
  }

  const { panelLayerId } = await context.params;
  const decodedPanelLayerId = decodeURIComponent(panelLayerId).trim();
  const url = new URL(request.url);
  const yearKey = url.searchParams.get("year")?.trim() || undefined;

  if (!isValidPanelLayerId(decodedPanelLayerId)) {
    return jsonError("Invalid panel layer id.", 400);
  }

  if (yearKey && !isValidYearKey(yearKey)) {
    return jsonError("Invalid year.", 400);
  }

  let result;

  try {
    result = await getCachedMunicipalAnalysisImageData(
      decodedPanelLayerId,
      yearKey,
    );
  } catch (error) {
    console.error("Erro ao carregar municipalAnalysis:", error);
    return jsonError("Unable to load municipal analysis.", 502);
  }

  if (!result.found) {
    return jsonError("Panel layer not found.", 404);
  }

  return NextResponse.json(
    {
      imageData: result.imageData,
    },
    {
      headers: {
        "Cache-Control": getMunicipalAnalysisCacheControlHeader(),
      },
    },
  );
}
