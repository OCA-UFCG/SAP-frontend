import { revalidatePath, revalidateTag } from "next/cache";
import { clearEarthEngineCacheForLayer } from "@/app/api/ee/cache";
import { clearMunicipalAnalysisCache } from "@/repositories/platform/municipalAnalysisCache";
import { clearGeeStatisticsSchemaCache } from "@/repositories/platform/geeStatisticsRepository";
import {
  clearPanelLayersCache,
  PANEL_LAYERS_CACHE_TAG,
} from "@/repositories/platform/panelLayerRepository";

/**
 * Invalida tudo o que uma escrita do catálogo no Contentful torna obsoleto.
 * São quatro caches distintos e um cache de fetch: a URL de tiles do Earth
 * Engine, o período de análise territorial, a lista memoizada de panelLayer, o
 * schema estatístico do GEE e a resposta do Contentful guardada no Data Cache
 * do Next. Publicar sem invalidar a tag deixava o índice novo fora de
 * `/api/ee` até o `revalidate` expirar.
 */
export function refreshPublicIndexCaches(panelLayerId: string) {
  // A memoização de assets estatísticos (statisticsAssetCache) fica de fora de
  // propósito: ela é indexada pelo `updateTime` do asset no Earth Engine, então
  // se invalida sozinha quando a tabela é reexportada. Limpá-la aqui jogaria
  // fora justamente as entradas que fazem a publicação ser rápida.
  clearEarthEngineCacheForLayer(panelLayerId);
  clearMunicipalAnalysisCache(panelLayerId);
  clearPanelLayersCache();
  clearGeeStatisticsSchemaCache();
  // "max" é a forma que o Next 16 aceita fora de Server Actions; sem o
  // segundo argumento a chamada é depreciada.
  revalidateTag(PANEL_LAYERS_CACHE_TAG, "max");
  revalidatePath("/[locale]/platform", "page");
}
