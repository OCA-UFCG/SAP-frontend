"use client";

import type { MunicipalityClassification } from "@/components/Map/classificationLayers";
import { isCompactImageData } from "@/utils/imageData";
import type { IEEInfo } from "@/utils/interfaces";

/**
 * A resposta das rotas de coropleta: o nível da faixa de cada município e a
 * paleta publicada no índice. Não traz os valores — quem desenha só precisa da
 * cor, e mandar o número dos 5.571 municípios seria uma resposta várias vezes
 * maior para pintar o mesmo mapa.
 */
export interface SheetChoroplethResponse {
  classificationByCode: Record<string, number>;
  excludedCodes: string[];
  palette: string[];
}

/**
 * Diz se a camada declara que o mapa dela é uma coropleta municipal. A marca
 * viaja no `imageData` justamente para o cliente decidir isso sem um segundo
 * pedido ao servidor — é ela que evita pedir tile ao `/api/ee` para um índice
 * que não tem raster nenhum.
 */
export function paintsMunicipalChoropleth(
  activeEEData: IEEInfo | null,
): boolean {
  if (!activeEEData || !isCompactImageData(activeEEData.imageData)) {
    return false;
  }

  return Boolean(activeEEData.imageData.mapVisualization?.municipalChoropleth);
}

/**
 * O endereço da coropleta de uma camada.
 *
 * A prévia do catálogo desenha um rascunho, que ainda não é um `panelLayer`
 * publicado: ela aponta o mapa para as rotas do rascunho pelo `tileApiPath`, e
 * a coropleta segue o mesmo endereço.
 *
 * `locationKey` pede só um município — é o que o mapa do relatório precisa, e
 * evita baixar a classificação do país inteiro para pintar um polígono.
 *
 * @example
 * buildSheetChoroplethPath("populacao-indigena", undefined, "2504009");
 * // "/api/municipal-analysis/populacao-indigena/choropleth?locationKey=2504009"
 */
export function buildSheetChoroplethPath(
  panelLayerId: string,
  tileApiPath?: string,
  locationKey?: string,
): string {
  const base = tileApiPath
    ? `${tileApiPath.replace(/\/ee$/u, "")}/choropleth`
    : `/api/municipal-analysis/${encodeURIComponent(panelLayerId)}/choropleth`;

  return locationKey
    ? `${base}?locationKey=${encodeURIComponent(locationKey)}`
    : base;
}

/**
 * Busca a classificação municipal já na forma que `classificationLayers`
 * consome.
 *
 * @example
 * const classification = await fetchSheetChoropleth(path, signal);
 */
export async function fetchSheetChoropleth(
  path: string,
  signal?: AbortSignal,
): Promise<MunicipalityClassification> {
  const response = await fetch(path, { signal });

  if (!response.ok) {
    throw new Error(`Choropleth request failed with ${response.status}`);
  }

  const { classificationByCode, excludedCodes, palette } =
    (await response.json()) as SheetChoroplethResponse;

  return { classificationByCode, excludedCodes, palette };
}
