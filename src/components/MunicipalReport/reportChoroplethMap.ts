"use client";

import type maplibregl from "maplibre-gl";
import {
  applyClassificationFeatureStates,
  applyClassificationPalette,
  CLASSIFICATION_TILE_SOURCE,
  ensureClassificationLayer,
  type MunicipalityClassification,
} from "@/components/Map/classificationLayers";

/**
 * Pinta no mapa do relatório o município classificado por uma coluna da
 * planilha.
 *
 * Usa só a fonte de tiles da malha municipal, e não o GeoJSON de visão geral
 * que o Monitoramento carrega abaixo do zoom 5: o mapa do relatório sempre
 * enquadra um município, então nunca chega lá — e baixar os ~490 KB da visão
 * geral por item do relatório custaria mais do que o mapa inteiro.
 *
 * A paleta entra por `setPaintProperty` a cada pintura porque a instância do
 * mapa é reaproveitada entre itens do relatório: sem isso o segundo índice
 * sairia com as cores do primeiro.
 *
 * @example
 * paintReportChoropleth(map, { classificationByCode: { "2504009": 4 }, excludedCodes: [], palette });
 */
export function paintReportChoropleth(
  map: maplibregl.Map,
  classification: MunicipalityClassification,
) {
  ensureClassificationLayer(map);
  applyClassificationPalette(map, classification.palette);
  applyClassificationFeatureStates(map, classification, [
    CLASSIFICATION_TILE_SOURCE,
  ]);
}
