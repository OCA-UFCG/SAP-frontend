import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import ee from "@google/earthengine";
import { getCachedUrl, getOrCreateCachedUrl } from "@/app/api/ee/cache";
import { consumeEeRateLimit } from "@/app/api/ee/rate-limit";
import { getAuthenticatedUserId } from "@/lib/server-session";
import {
  getGeeMapUrl,
  initializeGee,
} from "@/infrastructure/earth-engine/client";
import { ensureEeCacheWarmupStarted } from "@/app/api/ee/services";
import referenceLayers from "@/config/referenceLayers.json";

/**
 * Fixed reference overlay layers — FeatureCollections rendered with one style
 * per layer (see `REFERENCE_LAYER_COLORS`). These are **not** managed in
 * Contentful; their GEE asset IDs live in `src/config/referenceLayers.json`,
 * which the territory search script (`scripts/build-reference-territories.mjs`)
 * also reads — swapping an asset there and rerunning the script keeps the map
 * and the search on the same data.
 */
const REFERENCE_LAYER_ASSETS: Record<string, string> = Object.fromEntries(
  Object.entries(referenceLayers).map(([layerId, { assetId }]) => [
    layerId,
    assetId,
  ]),
);

interface ReferenceLayerStyle {
  color: string;
  fillColor: string;
  width: number;
}

interface ReferenceLayerColors {
  outline: string;
  fill: string;
}

// Com todas as camadas em cinza, não dava para distinguir uma terra indígena de
// uma UC quando elas se sobrepõem. Assentamentos mantêm o cinza original.
const REFERENCE_LAYER_COLORS: Record<string, ReferenceLayerColors> = {
  quilombolas: { outline: "6D1A36", fill: "8E2437" },
  assentamentos: { outline: "888888", fill: "CCCCCC" },
  terras_indigenas: { outline: "6B3E1F", fill: "8B572A" },
  unidades_conservacao: { outline: "1B4D2B", fill: "2E6B3F" },
};

const TRANSPARENT = "00000000";
const OUTLINE_WIDTH_PX = 2.5;
const OUTLINE_HALO = "FFFFFFCC";
const OUTLINE_HALO_WIDTH_PX = 4.5;

// Interior e contorno saem em imagens separadas porque o GEE entrega cada uma
// já pintada: numa imagem só, deixar o interior transparente desbotaria o
// contorno junto. O interior vai opaco — quem dosa a transparência dele é o
// cliente, conforme o zoom (`REFERENCE_OVERLAY_FILL_OPACITY`).
//
// De perto, sem o interior, é o contorno que marca o território, e a linha
// escura sozinha some sobre as cores escuras do índice (marrom da TI sobre o
// verde da produção primária, por exemplo). O halo claro por baixo mantém a
// linha legível sobre qualquer paleta.
const buildOutlineStyles = (
  colors: ReferenceLayerColors,
): ReferenceLayerStyle[] => [
  { color: OUTLINE_HALO, fillColor: TRANSPARENT, width: OUTLINE_HALO_WIDTH_PX },
  { color: colors.outline, fillColor: TRANSPARENT, width: OUTLINE_WIDTH_PX },
];

const buildFillStyles = (
  colors: ReferenceLayerColors,
): ReferenceLayerStyle[] => [
  { color: TRANSPARENT, fillColor: colors.fill, width: 0 },
];

// v3: interior e contorno em URLs separadas; a chave v2 guardava a imagem única.
const CACHE_KEY_PREFIX = "ref-overlay-v3";

function buildRefCacheKey(layerId: string, part: "outline" | "fill"): string {
  return `${CACHE_KEY_PREFIX}:${layerId}:${part}`;
}

/** Pinta cada estilo da lista por cima do anterior, numa imagem só. */
async function getReferenceLayerTileUrl(
  assetId: string,
  styles: ReferenceLayerStyle[],
): Promise<string> {
  await initializeGee();

  const collection = ee.FeatureCollection(assetId);
  const styledImage = styles
    .map((style) => collection.style(style))
    .reduce((bottom: any, top: any) => bottom.blend(top));

  return getGeeMapUrl(styledImage, {});
}

async function resolveCachedTileUrl(
  cacheKey: string,
  assetId: string,
  styles: ReferenceLayerStyle[],
): Promise<string> {
  // `getOrCreateCachedUrl` só compartilha requisições simultâneas; sem esta
  // leitura cada toggle geraria um `getMapId` novo no Earth Engine — a
  // `unidades_conservacao` sozinha leva ~4,5 s para responder.
  const cachedUrl = getCachedUrl(cacheKey);
  if (cachedUrl) return cachedUrl;

  return getOrCreateCachedUrl(cacheKey, () =>
    getReferenceLayerTileUrl(assetId, styles),
  );
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
    const colors = REFERENCE_LAYER_COLORS[layerParam];
    // As duas imagens são pedidas ao mesmo tempo, então a camada não demora
    // mais para aparecer do que quando era uma imagem só.
    const [url, fillUrl] = await Promise.all([
      resolveCachedTileUrl(
        buildRefCacheKey(layerParam, "outline"),
        assetId,
        buildOutlineStyles(colors),
      ),
      resolveCachedTileUrl(
        buildRefCacheKey(layerParam, "fill"),
        assetId,
        buildFillStyles(colors),
      ),
    ]);

    return NextResponse.json({ url, fillUrl }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? String(error) },
      { status: 500 },
    );
  }
}
