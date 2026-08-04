import { listCatalogEntries } from "@/services/indexCatalog/contentfulManagement";
import { createIndexCatalogDraft } from "@/services/indexCatalog/indexCatalogService";
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
    const result = await createIndexCatalogDraft(
      await readJsonBody(request),
      access.user,
    );
    return noStoreJson(result, 201);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
