import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { IEEInfo } from "@/utils/interfaces";
import {
  addUrlToCache,
  buildCacheKey,
  getEarthEngineUrl,
  hasKey,
  getCachedUrl,
} from "@/app/api/ee/services";

export async function POST(req: NextRequest) {
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

      console.log(new Date().toISOString(), " - Starting URL queries");

      const url = await getEarthEngineUrl(
        imageInfo.imageData[year].imageId,
        imageInfo.imageData[year].imageParams,
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
