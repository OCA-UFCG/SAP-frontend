import { checkCatalogNewData } from "@/services/indexCatalog/newDataCheck";
import {
  catalogErrorResponse,
  noStoreJson,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";

interface NewDataRouteContext {
  params: Promise<{ entryId: string }>;
}

/**
 * Só leitura: a verificação lista a pasta do Earth Engine e compara com a
 * validação gravada, sem escrever nada na entry. Por isso é um GET, e não passa
 * pelo `Idempotency-Key` exigido das mutações do catálogo.
 */
export async function GET(request: Request, context: NewDataRouteContext) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    return noStoreJson(await checkCatalogNewData(decodeURIComponent(entryId)));
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
