import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/server-session";
import { consumeMunicipalAnalysisRateLimit } from "@/app/api/municipal-analysis/rate-limit";
import { getMunicipalAnalysisCacheControlHeader } from "@/repositories/platform/municipalAnalysisCache";
import {
  buildMunicipalReportSeriesPatch,
  getMunicipalReportSeries,
} from "@/repositories/platform/municipalReportSeriesRepository";
import { getPanelLayerById } from "@/repositories/platform/panelLayerRepository";

interface MunicipalAnalysisSeriesRouteContext {
  params: Promise<{
    panelLayerId: string;
  }>;
}

const PANEL_LAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/u;
const MUNICIPALITY_CODE_PATTERN = /^\d{7}$/u;

function jsonError(
  message: string,
  status: number,
  headers: Record<string, string> = {},
) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        ...headers,
      },
    },
  );
}

// A série compartilha o balde de `/api/municipal-analysis` de propósito: é o
// mesmo painel disparando, e o teto é por usuário, não por rota.
async function rejectUnservableRequest(request: Request) {
  const authenticatedUserId = await getAuthenticatedUserId(request);

  if (!authenticatedUserId) {
    return jsonError("Unauthorized access.", 401);
  }

  const rateLimit = consumeMunicipalAnalysisRateLimit(authenticatedUserId);

  if (rateLimit.limited) {
    return jsonError("Too many municipal analysis requests.", 429, {
      ...rateLimit.headers,
      "Retry-After": String(rateLimit.retryAfterSeconds),
    });
  }

  return null;
}

export async function GET(
  request: Request,
  context: MunicipalAnalysisSeriesRouteContext,
) {
  const unservableResponse = await rejectUnservableRequest(request);

  if (unservableResponse) {
    return unservableResponse;
  }

  const { panelLayerId } = await context.params;
  const decodedPanelLayerId = decodeURIComponent(panelLayerId).trim();
  const municipalityCode = new URL(request.url).searchParams
    .get("locationKey")
    ?.trim();

  if (!PANEL_LAYER_ID_PATTERN.test(decodedPanelLayerId)) {
    return jsonError("Invalid panel layer id.", 400);
  }

  if (!municipalityCode || !MUNICIPALITY_CODE_PATTERN.test(municipalityCode)) {
    return jsonError("Invalid municipality code.", 400);
  }

  try {
    const panelLayer = await getPanelLayerById(decodedPanelLayerId);

    if (!panelLayer) {
      return jsonError("Panel layer not found.", 404);
    }

    if (!panelLayer.reportSeriesConfig) {
      return jsonError("Municipal time series not configured.", 404);
    }

    const { municipality } = await getMunicipalReportSeries(
      decodedPanelLayerId,
      municipalityCode,
      panelLayer.reportSeriesConfig,
    );

    if (!municipality) {
      return jsonError("Municipal time series not found.", 404);
    }

    return NextResponse.json(
      {
        imageData: buildMunicipalReportSeriesPatch(
          municipalityCode,
          municipality,
        ),
      },
      {
        headers: {
          "Cache-Control": getMunicipalAnalysisCacheControlHeader(),
        },
      },
    );
  } catch (error) {
    console.error("Erro ao carregar municipalReportSeries:", error);
    return jsonError("Unable to load municipal time series.", 502);
  }
}
