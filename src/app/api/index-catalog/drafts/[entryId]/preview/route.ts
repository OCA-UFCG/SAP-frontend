import {
  generateIndexCatalogPreview,
  getIndexCatalogPreview,
} from "@/services/indexCatalog/indexCatalogService";
import {
  getIdempotencyKey,
  runCatalogIdempotently,
} from "@/services/indexCatalog/idempotency";
import {
  catalogErrorResponse,
  noStoreJson,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";

interface PreviewRouteContext {
  params: Promise<{ entryId: string }>;
}

export async function GET(request: Request, context: PreviewRouteContext) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    return noStoreJson(
      await getIndexCatalogPreview(decodeURIComponent(entryId)),
    );
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

export async function POST(request: Request, context: PreviewRouteContext) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const decodedEntryId = decodeURIComponent(entryId);
    const result = await runCatalogIdempotently(
      `preview:${decodedEntryId}`,
      getIdempotencyKey(request),
      () => generateIndexCatalogPreview(decodedEntryId, access.user),
    );
    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
