import { revalidatePath } from "next/cache";
import { publishIndexCatalogDraft } from "@/services/indexCatalog/indexCatalogService";
import { clearEarthEngineCacheForLayer } from "@/app/api/ee/cache";
import { clearMunicipalAnalysisCache } from "@/repositories/platform/municipalAnalysisCache";
import { clearGeeStatisticsSchemaCache } from "@/repositories/platform/geeStatisticsRepository";
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

    clearEarthEngineCacheForLayer(result.panelLayerId);
    clearMunicipalAnalysisCache(result.panelLayerId);
    clearGeeStatisticsSchemaCache();
    revalidatePath("/[locale]/platform", "page");
    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
