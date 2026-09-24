import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import ee from "@google/earthengine";
import { getCachedUrl, getOrCreateCachedUrl } from "@/app/api/ee/cache";
import { consumeEeRateLimit } from "@/app/api/ee/rate-limit";
import { getAuthenticatedUserId } from "@/lib/server-session";
import { initializeGee } from "@/infrastructure/earth-engine/client";
import { ensureEeCacheWarmupStarted } from "@/app/api/ee/services";

/**
 * Fixed reference overlay layers — FeatureCollections rendered with one style
 * per layer (see `REFERENCE_LAYER_STYLES`). These are **not** managed in Contentful; their GEE asset IDs are
 * hardcoded here.
 */
const REFERENCE_LAYER_ASSETS: Record<string, string> = {
  quilombolas: "projects/obscaatinga/assets/Areas_Quilombolas_INCRA",
  assentamentos: "projects/obscaatinga/assets/Assentamento_Brasil_INCRA",
  terras_indigenas: "projects/obscaatinga/assets/TIs_Funai_jul26",
  unidades_conservacao:
    "projects/ee-ulissesalencar17/assets/cnuc_2026_03_atualizado",
};

interface ReferenceLayerStyle {
  color: string;
  fillColor: string;
  width: number;
}

// Com todas as camadas em cinza, não dava para distinguir uma terra indígena de
// uma UC quando elas se sobrepõem. Assentamentos mantêm o cinza original.
const REFERENCE_LAYER_STYLES: Record<string, ReferenceLayerStyle> = {
  quilombolas: { color: "6D1A36", fillColor: "8E243788", width: 0.5 },
  assentamentos: { color: "888888", fillColor: "CCCCCC88", width: 0.5 },
  terras_indigenas: { color: "6B3E1F", fillColor: "8B572A88", width: 0.5 },
  unidades_conservacao: { color: "1B4D2B", fillColor: "2E6B3F88", width: 0.5 },
};

// v2: a URL do tile carrega o estilo; a chave v1 ainda apontaria para o cinza.
const CACHE_KEY_PREFIX = "ref-overlay-v2";

function buildRefCacheKey(layerId: string): string {
  return `${CACHE_KEY_PREFIX}:${layerId}`;
}

async function getReferenceLayerTileUrl(
  assetId: string,
  style: ReferenceLayerStyle,
): Promise<string> {
  await initializeGee();

  const collection = ee.FeatureCollection(assetId);
  const styledImage = collection.style(style);

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
      getReferenceLayerTileUrl(assetId, REFERENCE_LAYER_STYLES[layerParam]),
    );

    return NextResponse.json({ url }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
