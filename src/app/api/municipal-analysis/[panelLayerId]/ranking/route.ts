import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import { getMunicipalAnalysisCacheControlHeader } from "@/repositories/platform/municipalAnalysisCache";
import { getPanelLayerById } from "@/repositories/platform/panelLayerRepository";
import { getTerritoryRanking } from "@/repositories/platform/territoryRankingRepository";

interface RankingRouteContext {
  params: Promise<{ panelLayerId: string }>;
}

const PANEL_LAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/u;
const YEAR_KEY_PATTERN = /^(\d{4})(?:-(0[1-9]|1[0-2])(?:-(?:01|11|21))?)?$/u;
const LOCATION_KEY_PATTERN =
  /^(?:[a-z]{2}|(?:2_regiao|3_bioma|4_asd|5_semiarido)-[a-z0-9-]+)$/u;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * Os valores dos territórios que um recorte lista em "Territórios por
 * classificação": os estados de uma região, ou os municípios de um estado,
 * bioma, Semiárido ou ASD.
 *
 * É uma rota à parte de `/api/municipal-analysis/[panelLayerId]` porque o
 * painel do recorte não deve esperar a lista: ela pode trazer mais de mil
 * municípios, e o panorama do recorte é um número só.
 */
export async function GET(request: Request, context: RankingRouteContext) {
  const unauthorizedResponse = await requireAuthenticatedRequest(request);
  if (unauthorizedResponse) {
    unauthorizedResponse.headers.set("Cache-Control", "no-store");
    return unauthorizedResponse;
  }

  const { panelLayerId } = await context.params;
  const decodedPanelLayerId = decodeURIComponent(panelLayerId).trim();
  const url = new URL(request.url);
  const yearKey = url.searchParams.get("year")?.trim() ?? "";
  const locationKey = url.searchParams.get("locationKey")?.trim() ?? "";

  if (!PANEL_LAYER_ID_PATTERN.test(decodedPanelLayerId)) {
    return jsonError("Invalid panel layer id.", 400);
  }
  if (!YEAR_KEY_PATTERN.test(yearKey)) {
    return jsonError("Invalid year.", 400);
  }
  if (!LOCATION_KEY_PATTERN.test(locationKey)) {
    return jsonError("Invalid location key.", 400);
  }

  const panelLayer = await getPanelLayerById(decodedPanelLayerId);
  if (!panelLayer) {
    return jsonError("Panel layer not found.", 404);
  }

  try {
    const ranking = await getTerritoryRanking(
      panelLayer,
      yearKey,
      locationKey,
    );
    if (!ranking) {
      return jsonError("This location has no territory ranking.", 404);
    }
    return NextResponse.json(ranking, {
      headers: { "Cache-Control": getMunicipalAnalysisCacheControlHeader() },
    });
  } catch (error) {
    console.error(
      `[territoryRanking] falha ao montar a lista de ${decodedPanelLayerId}/${yearKey}/${locationKey}:`,
      error,
    );
    return jsonError("Unable to load territory ranking.", 502);
  }
}
