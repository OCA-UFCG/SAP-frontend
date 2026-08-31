import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import ee from "@google/earthengine";
import { getCachedUrl, getOrCreateCachedUrl } from "@/app/api/ee/cache";
import { consumeEeRateLimit } from "@/app/api/ee/rate-limit";
import { getAuthenticatedUserId } from "@/lib/server-session";
import { initializeGee } from "@/infrastructure/earth-engine/client";
import { ensureEeCacheWarmupStarted } from "@/app/api/ee/services";

/**
 * Fixed reference overlay layers — FeatureCollections rendered with a shared
 * gray style. These are **not** managed in Contentful; their GEE asset IDs are
 * hardcoded here.
 */
const REFERENCE_LAYER_ASSETS: Record<string, string> = {
  quilombolas: "projects/obscaatinga/assets/Areas_Quilombolas_INCRA",
  assentamentos: "projects/obscaatinga/assets/Assentamento_Brasil_INCRA",
  terras_indigenas: "projects/obscaatinga/assets/TIs_Funai_jul26",
  unidades_conservacao:
    "projects/ee-ulissesalencar17/assets/cnuc_2026_03_atualizado",
};

const GRAY_STYLE = {
  color: "888888",
  fillColor: "CCCCCC88",
  width: 0.5,
};

const CACHE_KEY_PREFIX = "ref-overlay-v1";

function buildRefCacheKey(layerId: string): string {
  return `${CACHE_KEY_PREFIX}:${layerId}`;
}

async function getReferenceLayerTileUrl(assetId: string): Promise<string> {
  await initializeGee();

  const collection = ee.FeatureCollection(assetId);
  const styledImage = collection.style(GRAY_STYLE);

  const mapId = await new Promise<{ urlFormat: string }>((resolve, reject) => {
    styledImage.getMapId({}, (obj: any, error: any) =>
      error ? reject(new Error(error)) : resolve(obj),
    );
  });

  return mapId.urlFormat;
}

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
    const cacheKey = buildRefCacheKey(layerParam);
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
