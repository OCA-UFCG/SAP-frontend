import type maplibregl from "maplibre-gl";
import { useEffect, useRef } from "react";
import {
  CLASSIFICATION_SOURCES,
  applyClassificationFeatureStates,
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
 * useMunicipalityClassification(mapRef, analysis, overview, mapInstanceVersion);
 */
export const useMunicipalityClassification = (
  mapRef: React.RefObject<maplibregl.Map | null>,
  classification: MunicipalityClassification | null,
  overviewGeoJson: MunicipalityOverviewGeoJson | null,
  mapInstanceVersion: number,
) => {
  const appliedCodesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const syncClassification = () => {
      if (!map.getSource(MUNICIPALITY_SOURCE_ID)) return;

      ensureClassificationLayer(map);

      if (classification && overviewGeoJson) {
        ensureClassificationOverviewLayer(map, overviewGeoJson);
      }

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
};
