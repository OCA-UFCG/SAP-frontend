import {
  catalogErrorResponse,
  noStoreJson,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import { getIndexCatalogDraftChoroplethValues } from "@/services/indexCatalog/indexCatalogService";

const YEAR_PATTERN = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/u;

interface DraftChoroplethRouteContext {
  params: Promise<{ entryId: string }>;
}

/**
 * Os valores municipais de um rascunho de índice de planilha, para a prévia do
 * Monitoramento pintar a coropleta antes de o índice existir em produção.
 *
 * É a irmã de `/api/municipal-analysis/[panelLayerId]/choropleth`, pelo mesmo
 * motivo que a prévia tem a sua própria rota de tiles: o índice em rascunho
 * ainda não tem `panelLayer` publicado para a rota de produção encontrar.
 */
export async function GET(
  request: Request,
  context: DraftChoroplethRouteContext,
) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const year = new URL(request.url).searchParams.get("year")?.trim() ?? "";
    if (!YEAR_PATTERN.test(year)) {
      throw new Error("Período inválido.");
    }

    const { entryId } = await context.params;
    const values = await getIndexCatalogDraftChoroplethValues(
      decodeURIComponent(entryId),
      year,
    );

    if (!values) {
      return noStoreJson({ error: "Índice não é de planilha." }, 404);
    }

    return noStoreJson({ year, values });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
