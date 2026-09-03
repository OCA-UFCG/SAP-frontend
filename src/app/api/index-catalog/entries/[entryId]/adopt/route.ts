import {
  catalogErrorResponse,
  noStoreJson,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import { adoptLegacyIndexCatalogEntry } from "@/services/indexCatalog/legacyAdoption";
import {
  getIdempotencyKey,
  runCatalogIdempotently,
} from "@/services/indexCatalog/idempotency";

interface AdoptRouteContext {
  params: Promise<{ entryId: string }>;
}

/**
 * Adota um índice legado no escopo de apresentação. Não invalida cache algum
 * de propósito: a adoção escreve apenas o `catalogConfig` da entry, então o
 * índice publicado continua idêntico ao que está no ar.
 */
export async function POST(request: Request, context: AdoptRouteContext) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const decodedEntryId = decodeURIComponent(entryId);
    const result = await runCatalogIdempotently(
      `adopt:${decodedEntryId}`,
      getIdempotencyKey(request),
      () => adoptLegacyIndexCatalogEntry(decodedEntryId, access.user),
    );
    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
