import { NextResponse } from "next/server";
import { requireAuthenticatedRequest } from "@/lib/server-session";
import { getCachedSheetChoropleth } from "@/repositories/platform/amfeSheetChoroplethCache";

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

  try {
    const result = await getCachedSheetChoropleth(decodedPanelLayerId);

    if (!result) {
      return jsonError("Panel layer is not painted from a sheet column.", 404);
    }

    return NextResponse.json(result, {
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
