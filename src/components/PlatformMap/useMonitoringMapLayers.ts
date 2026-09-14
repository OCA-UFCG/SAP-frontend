"use client";

import { useCallback, useMemo, useState } from "react";
import type { BasemapId } from "@/components/Map/Map";
import {
  geoBrasilSource,
  resolveSpatialFocusBounds,
} from "@/components/Map/mapBounds";
import {
  useMapLayerActions,
  useMapLayerActiveState,
  useMapLayerViewState,
} from "@/components/MapLayerContext/MapLayerContext";
import { getAllowedStateUfs } from "@/utils/interestAreaStates";
import type { SpatialSelection } from "@/utils/spatialScope";
import { useEarthEngineTileLayer } from "./useEarthEngineTileLayer";
import { useSheetChoroplethLayer } from "./useSheetChoroplethLayer";
import { useReferenceOverlayTiles } from "./useReferenceOverlayTileLayers";
import { useSpatialBoundaryOverlay } from "./useSpatialBoundaryOverlay";

export type MonitoringMapLayers = ReturnType<typeof useMonitoringMapLayers>;

/**
 * Tudo o que a seção de Monitoramento pinta no mapa: a camada do Earth Engine
 * escolhida no painel, o contorno do recorte territorial e as camadas de
 * referência.
 *
 * Mora fora do componente do mapa pelo mesmo motivo do estado da AMFE: o mapa é
 * um só, e precisa ler as duas seções sem remontar ao trocar entre elas.
 */
export function useMonitoringMapLayers() {
  const { activeData, activeEEData } = useMapLayerActiveState();
  const {
    activeLegend,
    selectedState,
    selectedMunicipalityCode,
    activeYear,
    layerOpacity,
    spatialSelection,
    referenceOverlays,
  } = useMapLayerViewState();
  const {
    setSelectedState,
    setSelectedMunicipalityCode,
    setLayerOpacity,
    toggleReferenceOverlay,
    setSpatialSelection,
  } = useMapLayerActions();
  const sheetChoropleth = useSheetChoroplethLayer(activeEEData);
  // A camada de planilha não tem raster: passar `null` aqui é o que impede um
  // pedido ao `/api/ee` — e uma chamada ao Earth Engine — por um índice cujo
  // mapa é desenhado no próprio navegador.
  const { requestKey, status, tileLayerUrl } = useEarthEngineTileLayer(
    sheetChoropleth.isSheetLayer ? null : activeEEData,
    activeYear,
    spatialSelection,
  );
  const [readyRequestKey, setReadyRequestKey] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>("osm");

  const {
    tileUrls: referenceOverlayTileUrls,
    isLoading: isAnyReferenceOverlayLoading,
  } = useReferenceOverlayTiles(referenceOverlays);

  const handleTileLayerReady = useCallback((readyRequestKey: string) => {
    setReadyRequestKey((current) =>
      current === readyRequestKey ? current : readyRequestKey,
    );
  }, []);

  const allowedStateUfs = useMemo(
    () => getAllowedStateUfs(spatialSelection),
    [spatialSelection],
  );

  const {
    boundaryGeoJson,
    activeBoundaryGeoJson,
    status: boundaryStatus,
  } = useSpatialBoundaryOverlay(spatialSelection);

  const spatialFocusBounds = useMemo(() => {
    // Enquanto o contorno exato está em voo, não enquadrar pela união dos
    // estados: renderizaria um movimento grosseiro seguido de outro correto.
    if (boundaryStatus === "loading") return null;

    // Enquadrar pelo recorte ativo, não pela coleção inteira: em bioma a rota
    // devolve os seis biomas, cuja caixa envolvente é o Brasil — e é a mesma
    // para todos, então a câmera nem se moveria ao trocar de bioma.
    return resolveSpatialFocusBounds(
      geoBrasilSource,
      allowedStateUfs,
      activeBoundaryGeoJson,
    );
  }, [allowedStateUfs, activeBoundaryGeoJson, boundaryStatus]);

  const handleSpatialSelectionChange = useCallback(
    (selection: SpatialSelection) => {
      setSpatialSelection(selection);
      setSelectedState("br");
      setSelectedMunicipalityCode(null);
    },
    [setSpatialSelection, setSelectedState, setSelectedMunicipalityCode],
  );

  const hasRenderedCurrentRequest =
    status === "ready" && Boolean(requestKey) && readyRequestKey === requestKey;

  const isGeeLayerLoading =
    Boolean(activeEEData) &&
    (sheetChoropleth.isLoading ||
      (!sheetChoropleth.isSheetLayer &&
        (status === "loading" ||
          (status === "ready" && !hasRenderedCurrentRequest))));

  return {
    activeData,
    activeEEData,
    activeLegend,
    allowedStateUfs,
    basemap,
    setBasemap,
    boundaryGeoJson,
    handleSpatialSelectionChange,
    handleTileLayerReady,
    isAnyReferenceOverlayLoading,
    isGeeLayerLoading,
    layerOpacity,
    setLayerOpacity,
    referenceOverlays,
    referenceOverlayTileUrls,
    requestKey,
    selectedMunicipalityCode,
    setSelectedMunicipalityCode,
    selectedState,
    setSelectedState,
    spatialFocusBounds,
    spatialSelection,
    tileLayerUrl,
    toggleReferenceOverlay,
    municipalityClassification: sheetChoropleth.classification,
    municipalityOverviewGeoJson: sheetChoropleth.overviewGeoJson,
  };
}
