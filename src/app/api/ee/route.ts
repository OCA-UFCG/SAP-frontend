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
import type { EarthEngineTileRequest } from "@/services/mapServices";

export async function POST(req: NextRequest) {
  ensureEeCacheWarmupStarted();

  try {
    const name = req.nextUrl.searchParams.get("name") || "";
    const year = req.nextUrl.searchParams.get("year") || "";
    const request = (await req.json()) as EarthEngineTileRequest;

    if (!request.imageId || !Array.isArray(request.imageParams)) {
      return NextResponse.json(
        {
          error: `Missing Earth Engine payload for layer ${name} and year ${year}`,
        },
        { status: 400 },
      );
    }

    const cacheKey = buildCacheKey(
      name,
      year,
      request.imageId,
      request.imageParams,
      request.minScale,
      request.maxScale,
    );

    const urlOnCache = getCachedUrl(cacheKey);
    if (hasKey(cacheKey) && urlOnCache) {
      console.log(new Date().toISOString(), " - Getting URL on cache");

      return NextResponse.json({ url: urlOnCache }, { status: 200 });
    }

    console.log(new Date().toISOString(), " - Starting URL queries");

    const url = await getEarthEngineUrl(
      request.imageId,
      request.imageParams,
      request.minScale,
      request.maxScale,
    );

    console.log(new Date().toISOString(), " - Saving URL to cache");

    addUrlToCache(cacheKey, url);

    console.log(new Date().toISOString(), " - URL saved");

    return NextResponse.json({ url }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
