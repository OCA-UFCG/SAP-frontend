import { refreshPublicIndexCaches } from "@/app/api/index-catalog/caches";
import {
  catalogErrorResponse,
  noStoreJson,
  readJsonBody,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import {
  deleteIndexCatalogEntry,
  getIndexCatalogLifecycleImpact,
  publishIndexCatalogEntry,
  unpublishIndexCatalogEntry,
} from "@/services/indexCatalog/indexCatalogService";
import {
  getIdempotencyKey,
  runCatalogIdempotently,
} from "@/services/indexCatalog/idempotency";

interface LifecycleRouteContext {
  params: Promise<{ entryId: string }>;
}

export async function GET(request: Request, context: LifecycleRouteContext) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    return noStoreJson(
      await getIndexCatalogLifecycleImpact(decodeURIComponent(entryId)),
    );
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

export async function POST(request: Request, context: LifecycleRouteContext) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const decodedEntryId = decodeURIComponent(entryId);
    const body = (await readJsonBody(request)) as { action?: unknown };
    if (body.action !== "publish" && body.action !== "unpublish") {
      throw new Error("A ação deve ser publish ou unpublish.");
    }

    const result = await runCatalogIdempotently(
      `lifecycle:${body.action}:${decodedEntryId}`,
      getIdempotencyKey(request),
      () =>
        body.action === "publish"
          ? publishIndexCatalogEntry(decodedEntryId, access.user)
          : unpublishIndexCatalogEntry(decodedEntryId, access.user),
    );
    refreshPublicIndexCaches(result.panelLayerId);
    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}

export async function DELETE(request: Request, context: LifecycleRouteContext) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const decodedEntryId = decodeURIComponent(entryId);
    const body = (await readJsonBody(request)) as { confirmation?: unknown };
    if (typeof body.confirmation !== "string") {
      throw new Error("Informe o ID técnico para confirmar a remoção.");
    }
    const confirmation = body.confirmation;

    const result = await runCatalogIdempotently(
      `delete:${decodedEntryId}`,
      getIdempotencyKey(request),
      () => deleteIndexCatalogEntry(decodedEntryId, confirmation, access.user),
    );
    refreshPublicIndexCaches(result.panelLayerId);
    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
