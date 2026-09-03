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
import { saveIndexCatalogReportText } from "@/services/indexCatalog/reportTextService";

interface ReportTextRouteContext {
  params: Promise<{ entryId: string }>;
}

export async function POST(request: Request, context: ReportTextRouteContext) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const { entryId } = await context.params;
    const decodedEntryId = decodeURIComponent(entryId);
    const body = (await readJsonBody(request)) as { report?: unknown };
    const result = await runCatalogIdempotently(
      `report-text:${decodedEntryId}`,
      getIdempotencyKey(request),
      () =>
        saveIndexCatalogReportText(decodedEntryId, body.report, access.user),
    );
    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
