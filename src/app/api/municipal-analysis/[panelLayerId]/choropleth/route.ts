import { NextResponse } from "next/server";
import { isMunicipalSpreadsheetSource } from "@/contracts/municipalSpreadsheet";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import { getMunicipalAnalysisCacheControlHeader } from "@/repositories/platform/municipalAnalysisCache";
import { getSpreadsheetMunicipalValues } from "@/repositories/platform/municipalSpreadsheetRepository";
import { getPanelLayerById } from "@/repositories/platform/panelLayerRepository";

interface ChoroplethRouteContext {
  params: Promise<{ panelLayerId: string }>;
}

const PANEL_LAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/u;
const YEAR_KEY_PATTERN = /^(\d{4})(?:-(0[1-9]|1[0-2]))?$/u;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * O valor de cada município num período, que é o que o mapa precisa para pintar
 * a coropleta de um índice criado a partir de planilha.
 *
 * É uma rota à parte de `/api/municipal-analysis/[panelLayerId]` porque os dois
 * pedidos têm recortes diferentes: o painel pede um território por vez, e o
 * mapa precisa dos 5.570 municípios de uma vez. Misturá-los faria o painel
 * carregar o país inteiro para mostrar um número só.
 */
export async function GET(request: Request, context: ChoroplethRouteContext) {
  const unauthorizedResponse = await requireAuthenticatedRequest(request);
  if (unauthorizedResponse) {
    unauthorizedResponse.headers.set("Cache-Control", "no-store");
    return unauthorizedResponse;
  }

  const { panelLayerId } = await context.params;
  const decodedPanelLayerId = decodeURIComponent(panelLayerId).trim();
  const yearKey = new URL(request.url).searchParams.get("year")?.trim() ?? "";

  if (!PANEL_LAYER_ID_PATTERN.test(decodedPanelLayerId)) {
    return jsonError("Invalid panel layer id.", 400);
  }
  if (!YEAR_KEY_PATTERN.test(yearKey)) {
    return jsonError("Invalid year.", 400);
  }

  const panelLayer = await getPanelLayerById(decodedPanelLayerId);
  if (!panelLayer) {
    return jsonError("Panel layer not found.", 404);
  }
  if (!isMunicipalSpreadsheetSource(panelLayer.statisticsSource)) {
    return jsonError("Panel layer is not a spreadsheet index.", 400);
  }

  try {
    const values = await getSpreadsheetMunicipalValues(
      panelLayer.statisticsSource,
      yearKey,
    );
    return NextResponse.json(
      { year: yearKey, values },
      {
        headers: { "Cache-Control": getMunicipalAnalysisCacheControlHeader() },
      },
    );
  } catch (error) {
    console.error(
      `[municipalSpreadsheet] falha ao ler os valores municipais de ${decodedPanelLayerId}/${yearKey}:`,
      error,
    );
    return jsonError("Unable to load municipal values.", 502);
  }
}
