import "server-only";
import ee from "@google/earthengine";
import {
  addUrlToCache,
  CACHE_TTL_MS,
  getCachedUrl,
  getOrCreateCachedUrl,
} from "@/app/api/ee/cache";
import {
  getGeeMapUrl,
  initializeGee,
} from "@/infrastructure/earth-engine/client";
import referenceLayers from "@/config/referenceLayers.json";

/**
 * Fixed reference overlay layers — FeatureCollections rendered with one style
 * per layer (see `REFERENCE_LAYER_COLORS`). These are **not** managed in
 * Contentful; their GEE asset IDs live in `src/config/referenceLayers.json`,
 * which the territory search script (`scripts/build-reference-territories.mjs`)
 * also reads — swapping an asset there and rerunning the script keeps the map
 * and the search on the same data.
 */
export const REFERENCE_LAYER_ASSETS: Record<string, string> =
  Object.fromEntries(
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

type ReferenceLayerPart = "outline" | "fill";

function buildRefCacheKey(layerId: string, part: ReferenceLayerPart): string {
  return `${CACHE_KEY_PREFIX}:${layerId}:${part}`;
}

function buildStyles(layerId: string, part: ReferenceLayerPart) {
  const colors = REFERENCE_LAYER_COLORS[layerId];
  return part === "outline"
    ? buildOutlineStyles(colors)
    : buildFillStyles(colors);
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

function resolveCachedTileUrl(
  layerId: string,
  part: ReferenceLayerPart,
): Promise<string> {
  const cacheKey = buildRefCacheKey(layerId, part);
  // `getOrCreateCachedUrl` só compartilha requisições simultâneas; sem esta
  // leitura cada toggle geraria um `getMapId` novo no Earth Engine — a
  // `unidades_conservacao` sozinha leva ~4,5 s para responder.
  const cachedUrl = getCachedUrl(cacheKey);
  if (cachedUrl) return Promise.resolve(cachedUrl);

  return getOrCreateCachedUrl(cacheKey, () =>
    getReferenceLayerTileUrl(
      REFERENCE_LAYER_ASSETS[layerId],
      buildStyles(layerId, part),
    ),
  );
}

/**
 * Os endereços de tiles do contorno e do interior de um grupo de território.
 * As duas imagens são pedidas ao mesmo tempo, então a camada não demora mais
 * para aparecer do que quando era uma imagem só.
 *
 * const { url, fillUrl } = await resolveReferenceLayerUrls("quilombolas");
 */
export async function resolveReferenceLayerUrls(layerId: string) {
  const [url, fillUrl] = await Promise.all([
    resolveCachedTileUrl(layerId, "outline"),
    resolveCachedTileUrl(layerId, "fill"),
  ]);
  return { url, fillUrl };
}

// O endereço guardado vale 30 min (`CACHE_TTL_MS`). Renovar aos 20 min troca o
// endereço antes de ele vencer, e ninguém volta a esperar o Earth Engine
// preparar a imagem — que leva de 0,7 s a 1,7 s por grupo.
export const REFERENCE_LAYER_REFRESH_MS = Math.round((CACHE_TTL_MS * 2) / 3);

/**
 * Gera de novo os endereços dos quatro grupos e guarda no cache, um por vez
 * para não disputar a fila do Earth Engine com quem está usando a plataforma.
 * Cada parte é isolada: um asset com problema não impede os outros.
 */
export async function refreshReferenceLayerUrls() {
  for (const layerId of Object.keys(REFERENCE_LAYER_ASSETS)) {
    for (const part of ["fill", "outline"] as const) {
      try {
        const url = await getReferenceLayerTileUrl(
          REFERENCE_LAYER_ASSETS[layerId],
          buildStyles(layerId, part),
        );
        addUrlToCache(buildRefCacheKey(layerId, part), url);
      } catch (error) {
        console.error(
          `[referenceLayers] falha ao preparar o endereço de tiles: ${layerId} (${part})`,
          error,
        );
      }
    }
  }
}

// No `globalThis` pelo mesmo motivo do cache: uma segunda cópia deste módulo
// não deve abrir uma segunda renovação.
const refreshState = globalThis as typeof globalThis & {
  __sapReferenceLayerRefresh?: boolean;
};

/**
 * Prepara os endereços dos territórios quando o servidor sobe e os renova antes
 * de vencerem. Sem isso, a primeira pessoa a ligar cada grupo depois de um
 * deploy — ou depois de 30 min sem ninguém ligar — esperava o Earth Engine.
 */
export function startReferenceLayerUrlRefresh() {
  if (refreshState.__sapReferenceLayerRefresh) return;
  refreshState.__sapReferenceLayerRefresh = true;

  void refreshReferenceLayerUrls();
  setInterval(() => {
    void refreshReferenceLayerUrls();
  }, REFERENCE_LAYER_REFRESH_MS).unref?.();
}
