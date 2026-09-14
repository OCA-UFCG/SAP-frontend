import {
  catalogErrorResponse,
  noStoreJson,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import { buildSheetChoropleth } from "@/repositories/platform/amfeSheetChoroplethCache";
import { resolveCatalogPreviewTileLayer } from "@/services/indexCatalog/presentationService";
import { isCompactImageData } from "@/utils/imageData";

interface DraftChoroplethRouteContext {
  params: Promise<{ entryId: string }>;
}

/**
 * A coropleta de um rascunho, para a prévia administrativa desenhar o mapa
 * antes da publicação.
 *
 * Existe pelo mesmo motivo da rota de tiles do rascunho: a prévia mostra um
 * índice que ainda não é um `panelLayer` publicado, então a rota pública não
 * teria o que ler.
 */
export async function GET(
  request: Request,
  context: DraftChoroplethRouteContext,
) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const layer = await resolveCatalogPreviewTileLayer(
      decodeURIComponent(entryId),
    );

    const result = isCompactImageData(layer.imageData)
      ? await buildSheetChoropleth(layer.imageData.mapVisualization)
      : null;

    if (!result) {
      return noStoreJson(
        { error: "Este rascunho não é pintado a partir da planilha." },
        404,
      );
    }

    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
