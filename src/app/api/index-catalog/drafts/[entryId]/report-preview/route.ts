import {
  catalogErrorResponse,
  noStoreJson,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import { buildIndexCatalogReportPreview } from "@/services/indexCatalog/reportPreviewService";

interface ReportPreviewRouteContext {
  params: Promise<{ entryId: string }>;
}

/**
 * Rota própria, e não parte da resposta de `preview`, porque custa uma leitura
 * no Earth Engine: a validação já é a etapa lenta do catálogo, e a prévia do
 * relatório carrega depois, sem atrasar o mapa.
 */
export async function GET(request: Request, context: ReportPreviewRouteContext) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const preview = await buildIndexCatalogReportPreview(
      decodeURIComponent(entryId),
    );
    return noStoreJson(preview);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
