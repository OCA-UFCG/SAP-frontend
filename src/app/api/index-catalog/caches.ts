import { revalidatePath, revalidateTag } from "next/cache";
import { clearEarthEngineCacheForLayer } from "@/app/api/ee/cache";
import { clearGeeAssetTypeCache } from "@/app/api/ee/assetType";
import { clearSheetChoroplethCache } from "@/repositories/platform/amfeSheetChoroplethCache";
import { clearMunicipalAnalysisCache } from "@/repositories/platform/municipalAnalysisCache";
import { clearGeeStatisticsSchemaCache } from "@/repositories/platform/geeStatisticsRepository";
import { clearGeeStatisticsRowsCache } from "@/repositories/platform/geeStatisticsRowsCache";
import {
  clearPanelLayersCache,
  PANEL_LAYERS_CACHE_TAG,
} from "@/repositories/platform/panelLayerRepository";
import { clearDocTemplateCache } from "@/services/buildDoc/buildDocTemplate";
import { clearMunicipalReportCache } from "@/services/municipalReportCache";

/**
 * Invalida tudo o que uma escrita do catálogo no Contentful torna obsoleto.
 * São oito caches distintos e um cache de fetch: a URL de tiles do Earth
 * Engine, o tipo do asset no Earth Engine, o período de análise territorial, a
 * lista memoizada de panelLayer, o schema estatístico do GEE, as linhas
 * estatísticas já lidas do GEE, o Relatório Automático já montado, o texto do
 * Google Docs e a resposta do Contentful guardada no Data Cache do Next.
 * Publicar sem invalidar a tag deixava o índice novo fora de `/api/ee` até o
 * `revalidate` expirar.
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
  // A coropleta de uma camada de planilha é montada a partir dos limites
  // publicados: mudar as faixas sem limpá-la deixaria o mapa com as cores
  // antigas até o TTL, mesmo com a legenda nova já na tela.
  clearSheetChoroplethCache();
  // O relatório guarda o documento inteiro montado, indexado por município,
  // período e camadas pedidas — nunca por camada isolada, então não há como
  // invalidar só o índice publicado. Republicar um índice v2 não mudava a
  // chave (municipalReportCache versiona por `sourceRevision` justamente para
  // isso, mas um relatório já montado antes da publicação continuaria válido
  // pelos 10 minutos de TTL), e o operador via o relatório anterior.
  clearMunicipalReportCache();
  // O texto do Google Docs é cortado em blocos `[layer: <id>]`. Um índice novo
  // só ganha a sua seção quando alguém acrescenta o bloco ao documento, e
  // publicar é o momento em que isso acabou de acontecer.
  clearDocTemplateCache();
  // "max" é a forma que o Next 16 aceita fora de Server Actions; sem o
  // segundo argumento a chamada é depreciada.
  revalidateTag(PANEL_LAYERS_CACHE_TAG, "max");
  revalidatePath("/[locale]/platform", "page");
}
