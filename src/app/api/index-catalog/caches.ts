import { revalidatePath, revalidateTag } from "next/cache";
import { clearEarthEngineCacheForLayer } from "@/app/api/ee/cache";
import { clearGeeAssetTypeCache } from "@/app/api/ee/assetType";
import { clearMunicipalAnalysisCache } from "@/repositories/platform/municipalAnalysisCache";
import { clearGeeStatisticsSchemaCache } from "@/repositories/platform/geeStatisticsRepository";
import { clearGeeStatisticsRowsCache } from "@/repositories/platform/geeStatisticsRowsCache";
import {
  clearPanelLayersCache,
  PANEL_LAYERS_CACHE_TAG,
} from "@/repositories/platform/panelLayerRepository";

/**
 * Invalida tudo o que uma escrita do catálogo no Contentful torna obsoleto.
 * São seis caches distintos e um cache de fetch: a URL de tiles do Earth
 * Engine, o tipo do asset no Earth Engine, o período de análise territorial, a
 * lista memoizada de panelLayer, o schema estatístico do GEE, as linhas
 * estatísticas já lidas do GEE e a resposta do Contentful guardada no Data
 * Cache do Next. Publicar sem invalidar a tag deixava o índice novo fora de
 * `/api/ee` até o `revalidate` expirar.
 */
export function refreshPublicIndexCaches(panelLayerId: string) {
  // A memoização de assets estatísticos (statisticsAssetCache) fica de fora de
  // propósito: ela é indexada pelo `updateTime` do asset no Earth Engine, então
  // se invalida sozinha quando a tabela é reexportada. Limpá-la aqui jogaria
  // fora justamente as entradas que fazem a publicação ser rápida.
  clearEarthEngineCacheForLayer(panelLayerId);
  // O cache de tipo de asset é indexado por assetId, não por camada: publicar
  // um índice pode apontar a camada para um asset de outro tipo, então ele é
  // descartado inteiro. É um mapa pequeno, e cada entrada custa um `getAsset`.
  clearGeeAssetTypeCache();
  clearMunicipalAnalysisCache(panelLayerId);
  clearPanelLayersCache();
  clearGeeStatisticsSchemaCache();
  clearGeeStatisticsRowsCache();
  // "max" é a forma que o Next 16 aceita fora de Server Actions; sem o
  // segundo argumento a chamada é depreciada.
  revalidateTag(PANEL_LAYERS_CACHE_TAG, "max");
  revalidatePath("/[locale]/platform", "page");
}
