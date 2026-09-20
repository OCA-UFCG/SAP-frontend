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
  // A opacidade entra por ref, e não nas dependências do efeito abaixo, pelo
  // mesmo motivo de `useMunicipalityClassification`: regravar a coropleta
  // inteira custa duas escritas de feature-state por município nas duas sources
  // (mais de 11 mil num índice nacional), e a barra tem passo de 0,05 — um
  // arrasto de ponta a ponta faria isso umas vinte vezes na thread principal.
  // Mover a barra só precisa repintar as camadas, e é o efeito seguinte que faz.
  const fillOpacityRef = useRef(fillOpacity);

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
        fillOpacityRef.current,
      );
      applyIndexChoroplethPaint(
        map,
        choropleth.palette,
        fillOpacityRef.current,
      );

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
  }, [choropleth, mapInstanceVersion, mapRef]);

  // Mover a barra reescreve o paint das camadas e mais nada. A paleta entra nas
  // dependências porque a expressão de opacidade é montada a partir dela — sem
  // camada na tela ainda, `applyIndexChoroplethPaint` não faz nada, e o efeito
  // acima aplica o valor guardado assim que a coropleta existir.
  useEffect(() => {
    fillOpacityRef.current = fillOpacity;

    const map = mapRef.current;
    if (!map || !choropleth) return;

    applyIndexChoroplethPaint(map, choropleth.palette, fillOpacity);
  }, [choropleth, fillOpacity, mapRef]);
};
