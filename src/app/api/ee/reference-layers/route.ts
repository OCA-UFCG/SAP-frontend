import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCachedUrl, getOrCreateCachedUrl } from "@/app/api/ee/cache";
import { consumeEeRateLimit } from "@/app/api/ee/rate-limit";
import { getAuthenticatedUserId } from "@/lib/server-session";
import {
  REFERENCE_LAYER_ASSETS,
  buildReferenceLayerCacheKey,
  getReferenceLayerTileUrl,
} from "@/app/api/ee/referenceLayers";
import { ensureEeCacheWarmupStarted } from "@/app/api/ee/services";

export async function POST(req: NextRequest) {
  const authenticatedUserId = await getAuthenticatedUserId(req);
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

  const layerParam = req.nextUrl.searchParams.get("layer")?.trim() || "";
  const assetId = REFERENCE_LAYER_ASSETS[layerParam];

  if (!assetId) {
    return NextResponse.json(
      {
        error: `Unknown reference layer "${layerParam}". Valid values: ${Object.keys(REFERENCE_LAYER_ASSETS).join(", ")}`,
      },
      { status: 400 },
    );
  }

  try {
    const cacheKey = buildReferenceLayerCacheKey(layerParam);
    // `getOrCreateCachedUrl` só compartilha requisições simultâneas; sem esta
    // leitura cada toggle geraria um `getMapId` novo no Earth Engine — a
    // `unidades_conservacao` sozinha leva ~4,5 s para responder.
    const cachedUrl = getCachedUrl(cacheKey);
    if (cachedUrl) {
      return NextResponse.json({ url: cachedUrl }, { status: 200 });
    }

    const url = await getOrCreateCachedUrl(cacheKey, () =>
      getReferenceLayerTileUrl(assetId),
    );

    return NextResponse.json({ url }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
