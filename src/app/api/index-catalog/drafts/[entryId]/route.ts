import { getCatalogEntry } from "@/services/indexCatalog/contentfulManagement";
import { updateIndexCatalogDraft } from "@/services/indexCatalog/indexCatalogService";
import {
  catalogErrorResponse,
  noStoreJson,
  readJsonBody,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";

interface DraftRouteContext {
  params: Promise<{ entryId: string }>;
}

export async function GET(request: Request, context: DraftRouteContext) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const result = await getCatalogEntry(decodeURIComponent(entryId));
    return noStoreJson({ item: result.item });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

export async function PUT(request: Request, context: DraftRouteContext) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const result = await updateIndexCatalogDraft(
      decodeURIComponent(entryId),
      await readJsonBody(request),
      access.user,
    );
    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
