import "server-only";
import ee from "@google/earthengine";
import { getCachedUrl, getOrCreateCachedUrl } from "@/app/api/ee/cache";
import { initializeGee } from "@/infrastructure/earth-engine/client";

/**
 * Camadas de referência fixas ("Territórios") — FeatureCollections desenhadas
 * com um mesmo estilo cinza. Elas **não** são gerenciadas pelo Contentful; os
 * IDs dos assets do GEE ficam aqui.
 */
export const REFERENCE_LAYER_ASSETS: Record<string, string> = {
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

// A chave carrega o estilo na versão: mudar `GRAY_STYLE` sem subir o prefixo
// deixaria os processos servindo a URL antiga por até 30 min (CACHE_TTL_MS).
const CACHE_KEY_PREFIX = "ref-overlay-v1";

export function buildReferenceLayerCacheKey(layerId: string): string {
  return `${CACHE_KEY_PREFIX}:${layerId}`;
}

export async function getReferenceLayerTileUrl(
  assetId: string,
): Promise<string> {
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

/**
 * Pré-aquece a URL de tiles de cada território.
 *
 * São quatro idas ao Earth Engine, e sem elas a primeira pessoa que liga um
 * território depois de cada restart paga o `getMapId` inteiro na mão —
 * `unidades_conservacao` sozinha leva cerca de 4,5 s. Cada camada é isolada em
 * seu próprio try: uma falha de asset não pode derrubar o aquecimento das
 * outras nem o das camadas do painel.
 *
 * await warmReferenceLayerUrls();
 */
export const warmReferenceLayerUrls = async () => {
  for (const [layerId, assetId] of Object.entries(REFERENCE_LAYER_ASSETS)) {
    const cacheKey = buildReferenceLayerCacheKey(layerId);
    if (getCachedUrl(cacheKey)) continue;

    try {
      await getOrCreateCachedUrl(cacheKey, () =>
        getReferenceLayerTileUrl(assetId),
      );
    } catch (error) {
      console.error(
        `[referenceLayers] falha ao pré-aquecer a URL de tiles: ${layerId} (${assetId})`,
        error,
      );
    }
  }
};
