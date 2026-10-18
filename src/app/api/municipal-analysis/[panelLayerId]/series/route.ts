import { NextResponse } from "next/server";
import { isGeeMunicipalValueTableSource } from "@/contracts/geeMunicipalValueTable";
import { isMunicipalSpreadsheetSource } from "@/contracts/municipalSpreadsheet";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import { getGeeStatisticsSeriesPatch } from "@/repositories/platform/geeStatisticsRepository";
import { getMunicipalAnalysisCacheControlHeader } from "@/repositories/platform/municipalAnalysisCache";
import {
  buildMunicipalReportSeriesPatch,
  getMunicipalReportSeries,
} from "@/repositories/platform/municipalReportSeriesRepository";
import { getPanelLayerById } from "@/repositories/platform/panelLayerRepository";
import { isCompactImageData } from "@/utils/imageData";
import type { PanelLayerI } from "@/utils/interfaces";

interface MunicipalAnalysisSeriesRouteContext {
  params: Promise<{
    panelLayerId: string;
  }>;
}

const PANEL_LAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/u;
const MUNICIPALITY_CODE_PATTERN = /^\d{7}$/u;
const LOCATION_KEY_PATTERN =
  /^(?:br|[a-z]{2}|\d{7}|(?:2_regiao|3_bioma|4_asd|5_semiarido)-[a-z0-9-]+)$/u;

function seriesResponse(imageData: unknown) {
  return NextResponse.json(
    { imageData },
    {
      headers: {
        "Cache-Control": getMunicipalAnalysisCacheControlHeader(),
      },
    },
  );
}

/**
 * Uma camada cuja estatística é uma tabela do Earth Engine por período: a série
 * de qualquer território sai dela, sem a série municipal pré-gerada do
 * relatório.
 */
function getGeeSeriesSource(panelLayer: PanelLayerI) {
  const source = panelLayer.statisticsSource;

  return source &&
    !isMunicipalSpreadsheetSource(source) &&
    !isGeeMunicipalValueTableSource(source)
    ? source
    : null;
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
  context: MunicipalAnalysisSeriesRouteContext,
) {
  const unauthorizedResponse = await requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    unauthorizedResponse.headers.set("Cache-Control", "no-store");
    return unauthorizedResponse;
  }

  const { panelLayerId } = await context.params;
  const decodedPanelLayerId = decodeURIComponent(panelLayerId).trim();
  const locationKey = new URL(request.url).searchParams
    .get("locationKey")
    ?.trim();

  if (!PANEL_LAYER_ID_PATTERN.test(decodedPanelLayerId)) {
    return jsonError("Invalid panel layer id.", 400);
  }

  if (!locationKey || !LOCATION_KEY_PATTERN.test(locationKey)) {
    return jsonError("Invalid location key.", 400);
  }

  try {
    const panelLayer = await getPanelLayerById(decodedPanelLayerId);

    if (!panelLayer) {
      return jsonError("Panel layer not found.", 404);
    }

    if (!panelLayer.reportSeriesConfig) {
      const source = getGeeSeriesSource(panelLayer);

      if (!source || !isCompactImageData(panelLayer.imageData)) {
        return jsonError("Municipal time series not configured.", 404);
      }

      return seriesResponse(
        await getGeeStatisticsSeriesPatch(
          decodedPanelLayerId,
          locationKey,
          panelLayer.imageData.classes.length,
          source,
          Object.keys(panelLayer.imageData.years).sort(),
        ),
      );
    }

    const municipalityCode = locationKey;

    if (!MUNICIPALITY_CODE_PATTERN.test(municipalityCode)) {
      return jsonError("Invalid municipality code.", 400);
    }

    const { municipality } = await getMunicipalReportSeries(
      decodedPanelLayerId,
      municipalityCode,
      panelLayer.reportSeriesConfig,
    );

    if (!municipality) {
      return jsonError("Municipal time series not found.", 404);
    }

    return seriesResponse(
      buildMunicipalReportSeriesPatch(municipalityCode, municipality),
    );
  } catch (error) {
    console.error("Erro ao carregar municipalReportSeries:", error);
    return jsonError("Unable to load municipal time series.", 502);
  }
}
