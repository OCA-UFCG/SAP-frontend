import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import {
  getCachedSheetChoropleth,
  selectChoroplethMunicipality,
} from "@/repositories/platform/amfeSheetChoroplethCache";
import { MUNICIPALITY_KEY_PATTERN } from "@/utils/statisticsLocationScope";

interface ChoroplethRouteContext {
  params: Promise<{ panelLayerId: string }>;
}

const PANEL_LAYER_ID_PATTERN = /^[A-Za-z0-9_-]{1,80}$/u;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

/**
 * A classificação de cada município de uma camada pintada no navegador.
 *
 * Devolve o nível da faixa, e não o valor: quem desenha só precisa da cor, e
 * mandar o número de 5.571 municípios seria uma resposta várias vezes maior
 * para pintar exatamente o mesmo mapa. Os valores continuam vindo do painel de
 * análise, um território por vez.
 */
export async function GET(request: Request, context: ChoroplethRouteContext) {
  const unauthorizedResponse = await requireAuthenticatedRequest(request);

  if (unauthorizedResponse) {
    unauthorizedResponse.headers.set("Cache-Control", "no-store");
    return unauthorizedResponse;
  }

  const { panelLayerId } = await context.params;
  const decodedPanelLayerId = decodeURIComponent(panelLayerId).trim();

  if (!PANEL_LAYER_ID_PATTERN.test(decodedPanelLayerId)) {
    return jsonError("Invalid panel layer id.", 400);
  }

  // O mapa do relatório enquadra um município só e pede apenas o dele; o
  // Monitoramento desenha o país e omite o parâmetro.
  const locationKey = new URL(request.url).searchParams
    .get("locationKey")
    ?.trim();

  if (locationKey && !MUNICIPALITY_KEY_PATTERN.test(locationKey)) {
    return jsonError(
      `locationKey must be a 7-digit IBGE municipality code: ${locationKey}`,
      400,
    );
  }

  try {
    const result = await getCachedSheetChoropleth(decodedPanelLayerId);

    if (!result) {
      return jsonError("Panel layer is not painted from a sheet column.", 404);
    }

    const body = locationKey
      ? selectChoroplethMunicipality(result, locationKey)
      : result;

    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, max-age=600" },
    });
  } catch (error) {
    console.error(
      `[amfeSheet] falha ao montar a coropleta de ${decodedPanelLayerId}:`,
      error,
    );
    return jsonError("Unable to load the municipal choropleth.", 502);
  }
}
