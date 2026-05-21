import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  addUrlToCache,
  buildCacheKey,
  getCachedUrl,
  hasKey,
} from "@/app/api/ee/cache";
import {
  ensureEeCacheWarmupStarted,
  getEarthEngineUrl,
} from "@/app/api/ee/services";
import { consumeEeRateLimit } from "./rate-limit";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";
import { resolveImageYearEntry } from "@/utils/imageData";
import { requireAuthenticatedRequest } from "@/lib/server-session";

export async function POST(req: NextRequest) {
  const unauthorizedResponse = await requireAuthenticatedRequest(req);
  if (unauthorizedResponse) return unauthorizedResponse;

  ensureEeCacheWarmupStarted();

  const rateLimit = consumeEeRateLimit(req.headers);
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

    if (!name || !year) {
      return NextResponse.json(
        { error: "Missing required query parameters: name and year." },
        { status: 400 },
      );
    }

    const panelLayers = await getPanelLayers();
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

    const cacheKey = buildCacheKey(
      name,
      year,
      yearConfig.imageId,
      yearConfig.imageParams,
      layer.minScale,
      layer.maxScale,
    );

    const urlOnCache = getCachedUrl(cacheKey);
    if (hasKey(cacheKey) && urlOnCache) {
      console.log(new Date().toISOString(), " - Getting URL on cache");
      return NextResponse.json({ url: urlOnCache }, { status: 200 });
    }

    console.log(new Date().toISOString(), " - Starting URL queries");

    const url = await getEarthEngineUrl(
      yearConfig.imageId,
      yearConfig.imageParams,
      layer.minScale,
      layer.maxScale,
    );

    console.log(new Date().toISOString(), " - Saving URL to cache");
    addUrlToCache(cacheKey, url);
    console.log(new Date().toISOString(), " - URL saved");

    return NextResponse.json({ url }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
