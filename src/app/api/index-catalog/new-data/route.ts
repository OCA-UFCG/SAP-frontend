import { scanPublishedNewData } from "@/services/indexCatalog/publishedNewDataScan";
import {
  catalogErrorResponse,
  noStoreJson,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";

/**
 * A verificação de todos os índices publicados de uma vez, que a tela do
 * catálogo pede ao abrir para montar a seção "Publicados sem os dados mais
 * recentes".
 */
export async function GET(request: Request) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    return noStoreJson(await scanPublishedNewData());
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
