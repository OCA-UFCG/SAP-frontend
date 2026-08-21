import { publishIndexCatalogDraft } from "@/services/indexCatalog/indexCatalogService";
import { refreshPublicIndexCaches } from "@/app/api/index-catalog/caches";
import {
  getIdempotencyKey,
  runCatalogIdempotently,
} from "@/services/indexCatalog/idempotency";
import {
  catalogErrorResponse,
  noStoreJson,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";

interface PublishRouteContext {
  params: Promise<{ entryId: string }>;
}

export async function POST(request: Request, context: PublishRouteContext) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const decodedEntryId = decodeURIComponent(entryId);
    const result = await runCatalogIdempotently(
      `publish:${decodedEntryId}`,
      getIdempotencyKey(request),
      () => publishIndexCatalogDraft(decodedEntryId, access.user),
    );

    refreshPublicIndexCaches(result.panelLayerId);
    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
