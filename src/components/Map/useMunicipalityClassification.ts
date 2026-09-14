import type maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import {
  CLASSIFICATION_SOURCES,
  applyClassificationFeatureStates,
  applyClassificationFillOpacity,
  applyClassificationPalette,
  clearClassificationFeatureStates,
  ensureClassificationLayer,
  ensureClassificationOverviewLayer,
  type ClassificationSourceRef,
  type MunicipalityClassification,
  type MunicipalityOverviewGeoJson,
} from "./classificationLayers";
import { MUNICIPALITY_SOURCE_ID } from "./municipalityLayers";

const resolveReadySources = (
  map: maplibregl.Map,
): readonly ClassificationSourceRef[] =>
  CLASSIFICATION_SOURCES.filter(({ source }) => map.getSource(source));

/**
 * Mantém a coropleta da análise multicritério em sincronia com o resultado do
 * backend. O estado vive em feature-state das sources de municípios, que é
 * descartado quando o estilo recarrega — daí o reapply no evento `styledata`.
 *
 * @example
 * useMunicipalityClassification(mapRef, analysis, overview, version, 0.4);
 */
export const useMunicipalityClassification = (
  mapRef: React.RefObject<maplibregl.Map | null>,
  classification: MunicipalityClassification | null,
  overviewGeoJson: MunicipalityOverviewGeoJson | null,
  mapInstanceVersion: number,
  fillOpacity: number,
) => {
  const appliedCodesRef = useRef<Set<string>>(new Set());
  // A paleta acompanha a classificação, e a opacidade precisa dela para montar
  // um ramo por faixa: sem isso, uma camada de três faixas ficaria com o último
  // nível transparente, porque a expressão padrão só cobre cinco níveis fixos.
  const paletteRef = useRef(classification?.palette);
  // A opacidade entra por ref, e não nas dependências do efeito abaixo:
  // regravar a classificação inteira custa duas escritas de feature-state por
  // município (mais de 11 mil numa análise nacional) e mover a barra só precisa
  // repintar duas camadas. O efeito de pintura, logo adiante, é quem responde
  // à barra.
  const fillOpacityRef = useRef(fillOpacity);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    paletteRef.current = classification?.palette;

    const syncClassification = () => {
      if (!map.getSource(MUNICIPALITY_SOURCE_ID)) return;

      ensureClassificationLayer(map);

      if (classification && overviewGeoJson) {
        ensureClassificationOverviewLayer(map, overviewGeoJson);
      }

      // Depois de garantir as camadas: a barra pode ter mudado antes de a
      // coropleta existir, e o reload de estilo devolve o paint padrão.
      applyClassificationPalette(map, classification?.palette);
      applyClassificationFillOpacity(
        map,
        fillOpacityRef.current,
        classification?.palette?.length,
      );

      const sources = resolveReadySources(map);

      try {
        clearClassificationFeatureStates(map, appliedCodesRef.current, sources);
      } catch {
        // Source recriada pelo reload de estilo: o feature-state anterior já
        // não existe, então não há o que limpar.
      }

      appliedCodesRef.current = classification
        ? applyClassificationFeatureStates(map, classification, sources)
        : new Set();
    };

    syncClassification();
    map.on("styledata", syncClassification);

    return () => {
      map.off("styledata", syncClassification);
    };
  }, [classification, mapInstanceVersion, mapRef, overviewGeoJson]);

  // Mover a barra repinta as duas camadas de preenchimento e mais nada. Sem
  // camada na tela ainda, `applyClassificationFillOpacity` não faz nada, e o
  // efeito acima aplica o valor guardado assim que a coropleta existir.
  useEffect(() => {
    fillOpacityRef.current = fillOpacity;

    const map = mapRef.current;
    if (!map) return;

    applyClassificationFillOpacity(
      map,
      fillOpacity,
      paletteRef.current?.length,
    );
  }, [fillOpacity, mapRef]);
};
