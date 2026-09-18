"use client";

import { useEffect, useRef } from "react";
import type maplibregl from "maplibre-gl";
import type { IndexChoropleth } from "@/components/PlatformMap/useIndexChoroplethValues";
import {
  applyIndexChoroplethPaint,
  applyIndexChoroplethStates,
  clearIndexChoroplethStates,
  ensureIndexChoroplethLayers,
  removeIndexChoroplethLayers,
} from "./indexChoroplethLayers";
import { MUNICIPALITY_SOURCE_ID } from "./municipalityLayers";

/**
 * Pinta no mapa a coropleta municipal de um índice criado a partir de planilha.
 *
 * O estado vive em feature-state das sources de município, como na análise
 * multicritério, e por isso é reaplicado no evento `styledata`: trocar de mapa
 * base recarrega o estilo e descarta tudo o que estava pintado.
 *
 * @example
 * useIndexChoroplethPaint(mapRef, choropleth, mapInstanceVersion, 0.85);
 */
export const useIndexChoroplethPaint = (
  mapRef: React.RefObject<maplibregl.Map | null>,
  choropleth: IndexChoropleth | null,
  mapInstanceVersion: number,
  fillOpacity: number,
) => {
  const appliedCodesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncChoropleth = () => {
      if (!map.getSource(MUNICIPALITY_SOURCE_ID)) return;

      if (!choropleth) {
        removeIndexChoroplethLayers(map);
        appliedCodesRef.current = new Set();
        return;
      }

      ensureIndexChoroplethLayers(
        map,
        choropleth.palette,
        choropleth.overviewGeoJson,
        fillOpacity,
      );
      applyIndexChoroplethPaint(map, choropleth.palette, fillOpacity);

      try {
        clearIndexChoroplethStates(map, appliedCodesRef.current);
      } catch {
        // Source recriada pelo reload de estilo: não há estado anterior a limpar.
      }
      appliedCodesRef.current = applyIndexChoroplethStates(
        map,
        choropleth.classByCode,
      );
    };

    syncChoropleth();
    map.on("styledata", syncChoropleth);

    return () => {
      map.off("styledata", syncChoropleth);
    };
  }, [choropleth, fillOpacity, mapInstanceVersion, mapRef]);
};
