import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildCacheKey,
  getCachedUrl,
  getOrCreateCachedUrl,
  hasKey,
} from "@/app/api/ee/cache";
import {
  ensureEeCacheWarmupStarted,
  getEarthEngineUrl,
} from "@/app/api/ee/services";
import { consumeEeRateLimit } from "./rate-limit";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import {
  resolveImageCollectionPeriod,
  resolveImageCollectionSelection,
  resolveImageYearEntry,
} from "@/utils/imageData";
import { getAuthenticatedUserId } from "@/lib/server-session";
import { createServerTiming } from "@/utils/serverTiming";
import { resolveSpatialSelection } from "@/utils/spatialScope";

export async function POST(req: NextRequest) {
  const timing = createServerTiming();
  const finishAuth = timing.start();
  const authenticatedUserId = await getAuthenticatedUserId(req);
  finishAuth("auth", "Autenticação");
  if (!authenticatedUserId) {
    return NextResponse.json(
      { error: "Unauthorized access." },
      { status: 401 },
    );
  }

  ensureEeCacheWarmupStarted();

  const rateLimit = consumeEeRateLimit(authenticatedUserId);
  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "Too many Earth Engine requests. Try again later." },
      {
        status: 429,
        headers: {
          ...rateLimit.headers,
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  try {
    const name = req.nextUrl.searchParams.get("name")?.trim() || "";
    const year = req.nextUrl.searchParams.get("year")?.trim() || "";
    const spatialSelectionResult = resolveSpatialSelection(
      req.nextUrl.searchParams.get("spatialArea"),
      req.nextUrl.searchParams.get("spatialValue"),
    );

    if (!name || !year) {
      return NextResponse.json(
        { error: "Missing required query parameters: name and year." },
        { status: 400 },
      );
    }

    if (!spatialSelectionResult.ok) {
      return NextResponse.json(
        { error: spatialSelectionResult.error },
        { status: 400 },
      );
    }
    const spatialSelection = spatialSelectionResult.selection;

    const finishLayers = timing.start();
    const panelLayers = await getPanelLayers();
    finishLayers("resolve_layer", "Resolução da camada e configuração GEE");
    const layer = panelLayers.find((item) => item.id === name);

    if (!layer) {
      return NextResponse.json(
        { error: `Layer ${name} not found.` },
        { status: 404 },
      );
    }

    const yearConfig = resolveImageYearEntry(layer.imageData, year);
    if (!yearConfig) {
      return NextResponse.json(
        { error: `Year ${year} not available for layer ${name}.` },
        { status: 404 },
      );
    }

    const imageCollectionSelection =
      resolveImageCollectionSelection(yearConfig);
    // Derivado de `year` e do `mapVisualization`, que já entram na chave de
    // cache — por isso não é preciso somá-lo à assinatura.
    const imageCollectionPeriod = resolveImageCollectionPeriod(yearConfig);
    const cacheKey = buildCacheKey(
      name,
      year,
      yearConfig.imageId,
      yearConfig.imageParams,
      layer.minScale,
      layer.maxScale,
      yearConfig.mapVisualization,
      spatialSelection,
      imageCollectionSelection,
    );

    const finishCache = timing.start();
    const urlOnCache = getCachedUrl(cacheKey);
    finishCache(
      "cache_lookup",
      urlOnCache ? "Cache de URL GEE: hit" : "Cache de URL GEE: miss",
    );
    if (hasKey(cacheKey) && urlOnCache) {
      return NextResponse.json(
        { url: urlOnCache },
        {
          status: 200,
          headers: { "Server-Timing": timing.header() },
        },
      );
    }

    const finishEarthEngine = timing.start();
    // getOrCreateCachedUrl compartilha uma única ida ao Earth Engine entre os
    // requests simultâneos que caem no mesmo miss (cold start ou fim do TTL) e
    // popula o cache ao resolver.
    const url = await getOrCreateCachedUrl(cacheKey, () =>
      getEarthEngineUrl(
        yearConfig.imageId,
        yearConfig.imageParams,
        layer.minScale,
        layer.maxScale,
        {
          mapVisualization: yearConfig.mapVisualization,
          spatialSelection,
          ...(imageCollectionSelection ? { imageCollectionSelection } : {}),
          ...(imageCollectionPeriod ? { imageCollectionPeriod } : {}),
        },
      ),
    );
    finishEarthEngine(
      "earth_engine",
      "Geração da URL de tiles no Earth Engine",
    );

    return NextResponse.json(
      { url },
      {
        status: 200,
        headers: { "Server-Timing": timing.header() },
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
