import {
  catalogErrorResponse,
  noStoreJson,
  readJsonBody,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import {
  getIdempotencyKey,
  runCatalogIdempotently,
} from "@/services/indexCatalog/idempotency";
import { saveIndexCatalogPreviewMap } from "@/services/indexCatalog/previewMapService";

interface PreviewMapRouteContext {
  params: Promise<{ entryId: string }>;
}

export async function POST(request: Request, context: PreviewMapRouteContext) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const decodedEntryId = decodeURIComponent(entryId);
    const body = (await readJsonBody(request)) as { image?: unknown };
    const result = await runCatalogIdempotently(
      `preview-map:${decodedEntryId}`,
      getIdempotencyKey(request),
      () => saveIndexCatalogPreviewMap(decodedEntryId, body.image, access.user),
    );
    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
