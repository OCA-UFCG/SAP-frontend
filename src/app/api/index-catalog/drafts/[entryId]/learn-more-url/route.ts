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
import { saveIndexCatalogLearnMoreUrl } from "@/services/indexCatalog/learnMoreUrlService";

interface LearnMoreUrlRouteContext {
  params: Promise<{ entryId: string }>;
}

export async function POST(
  request: Request,
  context: LearnMoreUrlRouteContext,
) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const decodedEntryId = decodeURIComponent(entryId);
    const body = (await readJsonBody(request)) as { learnMoreUrl?: unknown };
    const result = await runCatalogIdempotently(
      `learn-more-url:${decodedEntryId}`,
      getIdempotencyKey(request),
      () =>
        saveIndexCatalogLearnMoreUrl(
          decodedEntryId,
          body.learnMoreUrl,
          access.user,
        ),
    );
    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
