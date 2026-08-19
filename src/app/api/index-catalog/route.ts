import { listCatalogEntries } from "@/services/indexCatalog/contentfulManagement";
import { createIndexCatalogDraft } from "@/services/indexCatalog/indexCatalogService";
import {
  getIdempotencyKey,
  runCatalogIdempotently,
} from "@/services/indexCatalog/idempotency";
import {
  catalogErrorResponse,
  noStoreJson,
  readJsonBody,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";

export async function GET(request: Request) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    return noStoreJson({ items: await listCatalogEntries() });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const body = await readJsonBody(request);
    const result = await runCatalogIdempotently(
      `create:${access.user.uid}`,
      getIdempotencyKey(request),
      () => createIndexCatalogDraft(body, access.user),
    );
    return noStoreJson(result, 201);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
