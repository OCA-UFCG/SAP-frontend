import { getIndexCatalogDraftMunicipalData } from "@/services/indexCatalog/indexCatalogService";
import {
  catalogErrorResponse,
  noStoreJson,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";

const YEAR_PATTERN = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/u;
const LOCATION_KEY_PATTERN =
  /^(?:br|[a-z]{2}|\d{7}|(?:2_regiao|3_bioma|4_asd|5_semiarido)-[a-z0-9-]+)$/u;

interface MunicipalRouteContext {
  params: Promise<{ entryId: string }>;
}

export async function GET(request: Request, context: MunicipalRouteContext) {
  const access = await requireCatalogAccess(request);
  if ("response" in access) return access.response;

  try {
    const year = new URL(request.url).searchParams.get("year")?.trim() ?? "";
    if (!YEAR_PATTERN.test(year)) {
      throw new Error("Período inválido.");
    }
    const locationKey =
      new URL(request.url).searchParams.get("locationKey")?.trim() ?? "";
    if (!LOCATION_KEY_PATTERN.test(locationKey)) {
      throw new Error("Localidade inválida.");
    }

    const { entryId } = await context.params;
    const result = await getIndexCatalogDraftMunicipalData(
      decodeURIComponent(entryId),
      year,
      locationKey,
    );

    if (!result) {
      return noStoreJson({ error: "Dados territoriais não encontrados." }, 404);
    }

    return noStoreJson(result);
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
