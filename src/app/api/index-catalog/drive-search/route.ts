import { searchDriveFilesByTag } from "@/services/indexCatalog/googleDrive";
import {
  catalogErrorResponse,
  noStoreJson,
  readJsonBody,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";

export async function POST(request: Request) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const body = (await readJsonBody(request)) as { tag?: unknown };
    const tag = typeof body.tag === "string" ? body.tag : "";
    return noStoreJson({ items: await searchDriveFilesByTag(tag) });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
