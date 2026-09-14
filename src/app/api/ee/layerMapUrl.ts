import {
  buildCacheKey,
  getCachedUrl,
  getOrCreateCachedUrl,
  hasKey,
  hasPendingUrl,
} from "@/app/api/ee/cache";
import { getEarthEngineUrl } from "@/app/api/ee/services";
import {
  isCompactImageData,
  resolveImageCollectionPeriod,
  resolveImageCollectionSelection,
  resolveImageYearEntry,
} from "@/utils/imageData";
import type { PanelLayerI } from "@/utils/interfaces";
import type { SpatialSelection } from "@/utils/spatialScope";

/**
 * Por que uma camada não virou URL de tiles. `year_not_found` é o caso comum e
 * não é erro de código: o período que o relatório resolveu pelos dados da
 * análise pode não existir no `imageData` do `panelLayer` — é o que fazia um
 * item do relatório sair com um retângulo cinza mudo.
 */
export type LayerMapUrlUnavailableReason =
  | "layer_not_found"
  | "year_not_found"
  /** Camada pintada município a município no navegador; não existe raster. */
  | "municipal_choropleth";

export type LayerMapUrlResolution =
  | { status: "cached"; url: string }
  | { status: "miss"; cacheKey: string; loadUrl: () => Promise<string> }
  /** Miss com ida ao Earth Engine já em voo: entra na promessa, não cobra vaga. */
  | { status: "in_flight"; cacheKey: string; loadUrl: () => Promise<string> }
  | { status: "unavailable"; reason: LayerMapUrlUnavailableReason };

function buildLayerCacheKey(
  layer: PanelLayerI,
  year: string,
  yearConfig: NonNullable<ReturnType<typeof resolveImageYearEntry>>,
  spatialSelection: SpatialSelection,
) {
  return buildCacheKey(
    layer.id,
    year,
    yearConfig.imageId,
    yearConfig.imageParams,
    layer.minScale,
    layer.maxScale,
    yearConfig.mapVisualization,
    spatialSelection,
    resolveImageCollectionSelection(yearConfig),
  );
}

function buildEarthEngineLoader(
  layer: PanelLayerI,
  yearConfig: NonNullable<ReturnType<typeof resolveImageYearEntry>>,
  spatialSelection: SpatialSelection,
) {
  const imageCollectionSelection = resolveImageCollectionSelection(yearConfig);
  const imageCollectionPeriod = resolveImageCollectionPeriod(yearConfig);

  return () =>
    getEarthEngineUrl(
      yearConfig.imageId,
      yearConfig.imageParams,
      layer.minScale,
      layer.maxScale,
      {
        mapVisualization: yearConfig.mapVisualization,
        spatialSelection,
        ...(imageCollectionSelection ? { imageCollectionSelection } : {}),
        ...(imageCollectionPeriod ? { imageCollectionPeriod } : {}),
      },
    );
}

/**
 * Diz se uma camada + período já tem URL de tiles em cache, se ainda precisa de
 * uma ida ao Earth Engine, ou se simplesmente não existe. Compartilhado por
 * `/api/ee` e `/api/ee/map-urls` para que as duas rotas nunca divirjam na chave
 * de cache nem no que consideram indisponível.
 *
 * @example
 * const resolution = resolveLayerMapUrl(panelLayers, "anaseca", "2024-12", selection);
 * if (resolution.status === "miss") await resolveMissedLayerMapUrl(resolution);
 */
export function resolveLayerMapUrl(
  panelLayers: readonly PanelLayerI[],
  name: string,
  year: string,
  spatialSelection: SpatialSelection,
): LayerMapUrlResolution {
  const layer = panelLayers.find((item) => item.id === name);
  if (!layer) return { status: "unavailable", reason: "layer_not_found" };

  // Uma camada de coropleta não tem asset: o `imageId` do período é só uma
  // etiqueta de procedência. Sem esta recusa, um pedido perdido gastaria uma
  // ida ao Earth Engine para falhar com "asset not found".
  if (
    isCompactImageData(layer.imageData) &&
    layer.imageData.mapVisualization?.municipalChoropleth
  ) {
    return { status: "unavailable", reason: "municipal_choropleth" };
  }

  const yearConfig = resolveImageYearEntry(layer.imageData, year);
  if (!yearConfig) return { status: "unavailable", reason: "year_not_found" };

  const cacheKey = buildLayerCacheKey(
    layer,
    year,
    yearConfig,
    spatialSelection,
  );
  const cachedUrl = getCachedUrl(cacheKey);
  if (hasKey(cacheKey) && cachedUrl) {
    return { status: "cached", url: cachedUrl };
  }

  return {
    status: hasPendingUrl(cacheKey) ? "in_flight" : "miss",
    cacheKey,
    // O `imageCollectionPeriod` é derivado de `year` e do `mapVisualization`,
    // que já entram na chave de cache — por isso não é preciso somá-lo à
    // assinatura.
    loadUrl: buildEarthEngineLoader(layer, yearConfig, spatialSelection),
  };
}

/**
 * Resolve um miss compartilhando uma única ida ao Earth Engine entre os
 * requests simultâneos que caírem na mesma chave.
 */
export function resolveMissedLayerMapUrl(
  resolution: Extract<LayerMapUrlResolution, { status: "miss" | "in_flight" }>,
) {
  return getOrCreateCachedUrl(resolution.cacheKey, resolution.loadUrl);
}
