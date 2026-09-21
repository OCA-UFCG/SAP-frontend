"use client";

import { useCallback, useMemo, useState } from "react";
import type { BasemapId } from "@/components/Map/Map";
import {
  CLASSIFICATION_MIN_ZOOM,
  type MunicipalityClassification,
} from "@/components/Map/classificationLayers";
import {
  geoBrasilSource,
  resolveSpatialFocusBounds,
} from "@/components/Map/mapBounds";
import { useSpatialBoundaryOverlay } from "@/components/PlatformMap/useSpatialBoundaryOverlay";
import { useReferenceOverlayTiles } from "@/components/PlatformMap/useReferenceOverlayTileLayers";
import { PLATFORM_MAP_INITIAL_ZOOM } from "@/components/PlatformMap/platformMapView";
import type { ReferenceLayerId } from "@/components/MapLayerContext/mapLayerState";
import { getAllowedStateUfs } from "@/utils/interestAreaStates";
import { DEFAULT_SPATIAL_SELECTION } from "@/utils/spatialScope";
import { toSpatialSelection } from "@/utils/amfeSpatialSelection";
import type { AnalyzePayload } from "@/utils/amfeInterfaces";
import useCities from "./useCities";
import useCitiesOverview from "./useCitiesOverview";

const INITIAL_FILL_OPACITY = 0.85;

export type AmfeAnalysisState = ReturnType<typeof useAmfeAnalysisState>;

/**
 * Todo o estado da análise multicritério: o que a pessoa pediu no formulário, o
 * que o backend devolveu e o que disso vira propriedade de mapa.
 *
 * Vive fora da tela da AMFE porque o mapa é o mesmo de Monitoramento e precisa
 * ler essas propriedades sem estar dentro dela. Enquanto ninguém roda uma
 * análise nada aqui vai à rede: `useCities` sai cedo sem payload e
 * `useCitiesOverview` só busca quando há classificação para pintar.
 */
export function useAmfeAnalysisState() {
  const [formPayload, setFormPayload] = useState<AnalyzePayload | null>(null);
  const [zoom, setZoom] = useState(PLATFORM_MAP_INITIAL_ZOOM);
  const [basemap, setBasemap] = useState<BasemapId>("osm");
  const [fillOpacity, setFillOpacity] = useState(INITIAL_FILL_OPACITY);
  const [referenceOverlays, setReferenceOverlays] = useState(
    () => new Set<ReferenceLayerId>(),
  );

  const { cities, excludedCities, coverage, loading, error } =
    useCities(formPayload);

  const toggleReferenceOverlay = useCallback((layerId: ReferenceLayerId) => {
    setReferenceOverlays((current) => {
      const next = new Set(current);
      if (next.has(layerId)) {
        next.delete(layerId);
      } else {
        next.add(layerId);
      }
      return next;
    });
  }, []);

  const { tileUrls: referenceOverlayTileUrls } =
    useReferenceOverlayTiles(referenceOverlays);

  const spatialSelection = useMemo(
    () =>
      toSpatialSelection(formPayload?.interestArea) ??
      DEFAULT_SPATIAL_SELECTION,
    [formPayload?.interestArea],
  );

  const municipalityClassification =
    useMemo<MunicipalityClassification | null>(() => {
      const codes = Object.keys(cities);
      if (codes.length === 0) return null;

      return {
        classificationByCode: Object.fromEntries(
          codes.map((code) => [code, cities[code].classification]),
        ),
        excludedCodes: Object.keys(excludedCities),
      };
    }, [cities, excludedCities]);

  const allowedStateUfs = useMemo(
    () => getAllowedStateUfs(spatialSelection),
    [spatialSelection],
  );

  const { overviewGeoJson } = useCitiesOverview(
    municipalityClassification !== null,
  );

  const isClassificationBelowZoomFloor =
    municipalityClassification !== null &&
    overviewGeoJson === null &&
    zoom < CLASSIFICATION_MIN_ZOOM;

  const { boundaryGeoJson, status: boundaryStatus } =
    useSpatialBoundaryOverlay(spatialSelection);

  const spatialFocusBounds = useMemo(() => {
    if (boundaryStatus === "loading") return null;

    return resolveSpatialFocusBounds(
      geoBrasilSource,
      allowedStateUfs,
      boundaryGeoJson,
    );
  }, [allowedStateUfs, boundaryGeoJson, boundaryStatus]);

  const imageOptions = useMemo(
    () =>
      municipalityClassification && !overviewGeoJson
        ? null
        : {
            classification: municipalityClassification,
            overviewGeoJson,
            boundaryGeoJson,
            spatialValue: spatialSelection.spatialValue,
            allowedStateUfs,
            bounds: spatialFocusBounds,
            fillOpacity,
          },
    [
      allowedStateUfs,
      boundaryGeoJson,
      fillOpacity,
      municipalityClassification,
      overviewGeoJson,
      spatialFocusBounds,
      spatialSelection.spatialValue,
    ],
  );

  return {
    formPayload,
    setFormPayload,
    cities,
    excludedCities,
    coverage,
    loading,
    error,
    setZoom,
    basemap,
    setBasemap,
    fillOpacity,
    setFillOpacity,
    referenceOverlays,
    toggleReferenceOverlay,
    referenceOverlayTileUrls,
    spatialSelection,
    municipalityClassification,
    overviewGeoJson,
    allowedStateUfs,
    boundaryGeoJson,
    spatialFocusBounds,
    isClassificationBelowZoomFloor,
    imageOptions,
  };
}
