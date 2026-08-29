import { NextResponse } from "next/server";
import { getAuthenticatedUserId } from "@/lib/server-session";
import { consumeMunicipalAnalysisRateLimit } from "@/app/api/municipal-analysis/rate-limit";
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
const LOCATION_KEY_PATTERN =
  /^(?:br|[a-z]{2}|\d{7}|(?:2_regiao|3_bioma|4_asd|5_semiarido)-[a-z0-9-]+)$/u;

function isValidPanelLayerId(value: string) {
  return PANEL_LAYER_ID_PATTERN.test(value);
}

function isValidYearKey(value: string) {
  return YEAR_KEY_PATTERN.test(value);
}

function isValidLocationKey(value: string) {
  return LOCATION_KEY_PATTERN.test(value);
}

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

/**
 * 401 quando não há sessão, 429 quando o usuário passou do teto da janela.
 *
 * O teto existe porque esta rota é a que mais gera trabalho no Earth Engine, e
 * a fila do SDK é uma só por processo: um cliente descontrolado aqui atrasa o
 * mapa de todos os outros usuários daquela instância.
 */
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
  context: MunicipalAnalysisRouteContext,
) {
  const unservableResponse = await rejectUnservableRequest(request);

  if (unservableResponse) {
    return unservableResponse;
  }

  const { panelLayerId } = await context.params;
  const decodedPanelLayerId = decodeURIComponent(panelLayerId).trim();
  const url = new URL(request.url);
  const yearKey = url.searchParams.get("year")?.trim() || undefined;
  const locationKey = url.searchParams.get("locationKey")?.trim() || undefined;

  if (!isValidPanelLayerId(decodedPanelLayerId)) {
    return jsonError("Invalid panel layer id.", 400);
  }

  if (yearKey && !isValidYearKey(yearKey)) {
    return jsonError("Invalid year.", 400);
  }

  if (locationKey && !isValidLocationKey(locationKey)) {
    return jsonError("Invalid location key.", 400);
  }

  if (locationKey && !yearKey) {
    return jsonError("A year is required when locationKey is provided.", 400);
  }

  let result;

  try {
    result = locationKey
      ? await getCachedMunicipalAnalysisImageData(
          decodedPanelLayerId,
          yearKey,
          locationKey,
        )
      : await getCachedMunicipalAnalysisImageData(decodedPanelLayerId, yearKey);
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
