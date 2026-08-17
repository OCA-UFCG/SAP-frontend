import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/server-session";
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
  context: MunicipalAnalysisSeriesRouteContext,
) {
  const unauthorizedResponse = await requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    unauthorizedResponse.headers.set("Cache-Control", "no-store");
    return unauthorizedResponse;
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
