import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  addUrlToCache,
  buildCacheKey,
  getCachedUrl,
  hasKey,
} from "@/app/api/ee/cache";
import { IEEInfo } from "@/utils/interfaces";
import { resolveImageYearEntry } from "@/utils/imageData";
import { ensureEeCacheWarmupStarted, getEarthEngineUrl } from "@/app/api/ee/services";

export async function POST(req: NextRequest) {
  ensureEeCacheWarmupStarted();

  try {
    const name = req.nextUrl.searchParams.get("name") || "";
    const year = req.nextUrl.searchParams.get("year") || "";
    const cacheKey = buildCacheKey(name, year);

    if (hasKey(cacheKey)) {
      console.log(new Date().toISOString(), " - Getting URL on cache");

      const url = getCachedUrl(cacheKey);

      return NextResponse.json({ url }, { status: 200 });
    } else {
      const imageInfo: IEEInfo = await req.json();
      const yearConfig = resolveImageYearEntry(imageInfo.imageData, year);

      if (!yearConfig) {
        return NextResponse.json(
          { error: `Year ${year} not found for layer ${name}` },
          { status: 400 },
        );
      }

      console.log(new Date().toISOString(), " - Starting URL queries");

      const url = await getEarthEngineUrl(
        yearConfig.imageId,
        yearConfig.imageParams,
        imageInfo.minScale,
        imageInfo.maxScale,
      );

      console.log(new Date().toISOString(), " - Saving URL to cache");

      addUrlToCache(cacheKey, url);

      console.log(new Date().toISOString(), " - URL saved");

      return NextResponse.json({ url }, { status: 200 });
    }
  } catch (error: any) {
    return NextResponse.json({ error }, { status: 500 });
  }
}
