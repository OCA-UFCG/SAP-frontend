import { addUrlToCache, buildCacheKey, getCachedUrl } from "@/app/api/ee/cache";
import { getEarthEngineUrl } from "@/app/api/ee/services";
import {
  catalogErrorResponse,
  noStoreJson,
  requireCatalogAccess,
} from "@/app/api/index-catalog/http";
import { getIndexCatalogPreview } from "@/services/indexCatalog/indexCatalogService";
import {
  resolveImageCollectionSelection,
  resolveImageYearEntry,
} from "@/utils/imageData";
import { resolveSpatialSelection } from "@/utils/spatialScope";

interface DraftEeRouteContext {
  params: Promise<{ entryId: string }>;
}

export async function POST(request: Request, context: DraftEeRouteContext) {
  const access = await requireCatalogAccess(request, { mutation: true });
  if ("response" in access) return access.response;

  try {
    const url = new URL(request.url);
    const year = url.searchParams.get("year")?.trim() ?? "";
    if (!year) {
      throw new Error("Informe o período da camada.");
    }

    const spatial = resolveSpatialSelection(
      url.searchParams.get("spatialArea"),
      url.searchParams.get("spatialValue"),
    );
    if (!spatial.ok) {
      throw new Error(spatial.error);
    }

    const { entryId } = await context.params;
    const preview = await getIndexCatalogPreview(decodeURIComponent(entryId));
    const layer = preview.panelLayer;
    const yearConfig = resolveImageYearEntry(layer.imageData, year);

    if (!yearConfig) {
      return noStoreJson(
        { error: `Período ${year} não disponível na prévia.` },
        404,
      );
    }
    const imageCollectionSelection =
      resolveImageCollectionSelection(yearConfig);

    const cacheKey = buildCacheKey(
      `catalog-preview:${entryId}:${layer.id}`,
      year,
      yearConfig.imageId,
      yearConfig.imageParams,
      layer.minScale,
      layer.maxScale,
      yearConfig.mapVisualization,
      spatial.selection,
      imageCollectionSelection,
    );
    const cachedUrl = getCachedUrl(cacheKey);
    if (cachedUrl) {
      return noStoreJson({ url: cachedUrl });
    }

    const tileUrl = await getEarthEngineUrl(
      yearConfig.imageId,
      yearConfig.imageParams,
      layer.minScale,
      layer.maxScale,
      {
        mapVisualization: yearConfig.mapVisualization,
        spatialSelection: spatial.selection,
        ...(imageCollectionSelection ? { imageCollectionSelection } : {}),
      },
    );
    addUrlToCache(cacheKey, tileUrl);

    return noStoreJson({ url: tileUrl });
  } catch (error) {
    return catalogErrorResponse(error);
  }
}
