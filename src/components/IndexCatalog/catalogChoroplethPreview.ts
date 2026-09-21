"use client";

import { parseMunicipalSpreadsheetSnapshot } from "@/contracts/municipalSpreadsheetSnapshot";
import { isMunicipalSpreadsheetSource } from "@/contracts/municipalSpreadsheet";
import type { MunicipalityOverviewGeoJson } from "@/components/Map/classificationLayers";
import { CITIES_OVERVIEW_URL } from "@/components/Amfe/useCitiesOverview";
import type { IndexCatalogPreview } from "@/types/indexCatalog";
import { isCompactImageData } from "@/utils/imageData";
import { classifyValueByThresholds } from "@/utils/valueThresholds";

export interface CatalogChoroplethPreview {
  palette: string[];
  classByCode: Record<string, number>;
  overviewGeoJson: MunicipalityOverviewGeoJson;
}

interface ChoroplethPreviewSource {
  imageData: IndexCatalogPreview["panelLayer"]["imageData"];
  statisticsSource?: IndexCatalogPreview["panelLayer"]["statisticsSource"];
}

/**
 * O endereço do instantâneo de um índice de planilha em rascunho, ou `null`
 * quando o mapa do índice vem do Earth Engine.
 *
 * O arquivo é gravado já na validação, então a prévia lê exatamente o que a
 * plataforma vai servir depois de publicado.
 */
export function resolveChoroplethSnapshotUrl(
  source: ChoroplethPreviewSource,
): string | null {
  const statisticsSource = source.statisticsSource;
  if (!isMunicipalSpreadsheetSource(statisticsSource)) return null;
  if (!isCompactImageData(source.imageData)) return null;
  if (source.imageData.mapVisualization?.sourceType !== "municipalChoropleth") {
    return null;
  }
  return statisticsSource.snapshot?.url ?? null;
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error(`A leitura de ${url} respondeu ${response.status}.`);
  }
  return (await response.json()) as T;
}

/**
 * Os dados que a captura da imagem de prévia precisa para desenhar a coropleta
 * de um índice de planilha.
 *
 * A imagem do cartão enquadra o Brasil inteiro, abaixo do zoom em que existem
 * tiles de município: é por isso que o GeoJSON de visão geral entra aqui e não
 * é opcional como no mapa do Monitoramento.
 *
 * @example
 * const preview = await loadCatalogChoroplethPreview(source, "2023");
 */
export async function loadCatalogChoroplethPreview(
  source: ChoroplethPreviewSource,
  period: string,
  signal?: AbortSignal,
): Promise<CatalogChoroplethPreview | null> {
  const snapshotUrl = resolveChoroplethSnapshotUrl(source);
  if (!snapshotUrl || !isCompactImageData(source.imageData)) return null;

  const mapVisualization = source.imageData.mapVisualization;
  const thresholds = mapVisualization?.thresholds ?? [];
  const [snapshot, overviewGeoJson] = await Promise.all([
    fetchJson<unknown>(snapshotUrl, signal).then(
      parseMunicipalSpreadsheetSnapshot,
    ),
    fetchJson<MunicipalityOverviewGeoJson>(CITIES_OVERVIEW_URL, signal),
  ]);

  const position = snapshot.periods.indexOf(period);
  const classByCode: Record<string, number> = {};
  for (const [locationKey, values] of Object.entries(snapshot.values)) {
    const value = position < 0 ? null : values[position];
    if (
      !/^\d{7}$/u.test(locationKey) ||
      value === null ||
      value === undefined
    ) {
      continue;
    }
    classByCode[locationKey] = classifyValueByThresholds(value, thresholds, 0);
  }

  return {
    palette: mapVisualization?.palette ?? [],
    classByCode,
    overviewGeoJson,
  };
}
