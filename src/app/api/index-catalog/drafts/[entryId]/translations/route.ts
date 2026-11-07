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
import { saveIndexCatalogTranslations } from "@/services/indexCatalog/translationsService";

interface TranslationsRouteContext {
  params: Promise<{ entryId: string }>;
}

export async function POST(
  request: Request,
  context: TranslationsRouteContext,
) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const decodedEntryId = decodeURIComponent(entryId);
    const body = (await readJsonBody(request)) as { translations?: unknown };
    const result = await runCatalogIdempotently(
      `translations:${decodedEntryId}`,
      getIdempotencyKey(request),
      () =>
        saveIndexCatalogTranslations(
          decodedEntryId,
          body.translations,
          access.user,
        ),
    );
    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
