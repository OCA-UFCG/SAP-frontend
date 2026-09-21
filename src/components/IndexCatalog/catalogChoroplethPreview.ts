"use client";

import type { MunicipalityOverviewGeoJson } from "@/components/Map/classificationLayers";
import { CITIES_OVERVIEW_URL } from "@/components/Amfe/useCitiesOverview";
import {
  fetchMunicipalValues,
  resolveChoroplethConfig,
  toClassByCode,
  type ChoroplethLayerSource,
} from "@/components/PlatformMap/useIndexChoroplethValues";

export interface CatalogChoroplethPreview {
  palette: string[];
  classByCode: Record<string, number>;
  overviewGeoJson: MunicipalityOverviewGeoJson;
}

async function fetchOverviewGeoJson(signal?: AbortSignal) {
  const response = await fetch(CITIES_OVERVIEW_URL, { signal });
  if (!response.ok) {
    throw new Error(
      `A leitura de ${CITIES_OVERVIEW_URL} respondeu ${response.status}.`,
    );
  }
  return (await response.json()) as MunicipalityOverviewGeoJson;
}

/**
 * Os dados que a captura da imagem de prévia precisa para desenhar a coropleta
 * de um índice de planilha.
 *
 * Os valores vêm da mesma rota que a prévia do Monitoramento usa — a do
 * rascunho, quando o índice ainda não foi publicado — e não do asset de
 * instantâneo: esse asset só é gravado na publicação, então um índice de
 * planilha novo não tem nenhum, e a captura caía na rota de tiles do Earth
 * Engine, que ele também não tem.
 *
 * A imagem do cartão enquadra o Brasil inteiro, abaixo do zoom em que existem
 * tiles de município: é por isso que o GeoJSON de visão geral entra aqui e não
 * é opcional como no mapa do Monitoramento.
 *
 * @example
 * const preview = await loadCatalogChoroplethPreview(source, "2023");
 */
export async function loadCatalogChoroplethPreview(
  source: ChoroplethLayerSource,
  period: string,
  signal?: AbortSignal,
): Promise<CatalogChoroplethPreview | null> {
  const config = resolveChoroplethConfig(source);
  if (!config || !period) return null;

  const [values, overviewGeoJson] = await Promise.all([
    fetchMunicipalValues(config.valuesUrl, period, signal),
    fetchOverviewGeoJson(signal),
  ]);

  return {
    palette: config.palette,
    classByCode: toClassByCode(values, config.thresholds),
    overviewGeoJson,
  };
}
