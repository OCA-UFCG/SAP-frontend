"use client";
import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import { useEarthEngineTileLayer } from "./useEarthEngineTileLayer";
import { useReferenceOverlayTiles } from "./useReferenceOverlayTileLayers";
import { useSpatialBoundaryOverlay } from "./useSpatialBoundaryOverlay";
import MapComponent from "../Map/MapComponent";
import type { BasemapId } from "../Map/Map";
import type { SpatialSelection } from "@/utils/spatialScope";
import { geoBrasilSource, resolveSpatialFocusBounds } from "../Map/mapBounds";
import {
  useMapLayerActions,
  useMapLayerActiveState,
  useMapLayerViewState,
} from "@/components/MapLayerContext/MapLayerContext";
import { BasemapControl } from "@/components/MapControls/BasemapControl";
import { LayerOpacityControl } from "@/components/MapControls/LayerOpacityControl";
import { ReferenceOverlaysControl } from "@/components/MapControls/ReferenceOverlaysControl";

interface PlatformMapProps {
  showMonitoringOverlays?: boolean;
}

import { getAllowedStateUfs } from "@/utils/interestAreaStates";

export function PlatformMap({
  showMonitoringOverlays = true,
}: PlatformMapProps) {
  const t = useTranslations("PlatformMap");
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
  const { requestKey, status, tileLayerUrl } = useEarthEngineTileLayer(
    activeEEData,
    activeYear,
    spatialSelection,
  );
  const [readyRequestKey, setReadyRequestKey] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>("osm");

  const {
    tileUrls: readyReferenceOverlayTileUrls,
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
    (status === "loading" ||
      (status === "ready" && !hasRenderedCurrentRequest));

  return (
    <div className="absolute inset-0">
      <div className="relative flex w-full h-full z-10">
        <MapComponent
          mapMode="platform"
          minZoom={3}
          center={[-15.749997, -47.9499962]}
          zoom={4}
          showStatesBorder
          dadosCDI={activeData ?? undefined}
          estadoSelecionado={selectedState.toUpperCase()}
          selectedMunicipalityCode={selectedMunicipalityCode}
          className="w-full h-full"
          tileLayerUrl={tileLayerUrl}
          tileLayerRequestKey={requestKey}
          layerOpacity={layerOpacity}
          allowedStateUfs={allowedStateUfs}
          spatialBoundaryGeoJson={boundaryGeoJson}
          spatialFocusBounds={spatialFocusBounds}
          basemap={basemap}
          referenceOverlayTileUrls={readyReferenceOverlayTileUrls}
          spatialArea={spatialSelection.spatialArea}
          spatialValue={spatialSelection.spatialValue}
          onStateSelect={(uf: string) => setSelectedState(uf.toLowerCase())}
          onSelectedMunicipalityCodeChange={setSelectedMunicipalityCode}
          onSpatialSelectionChange={handleSpatialSelectionChange}
          onTileLayerReady={handleTileLayerReady}
        />

        {(isGeeLayerLoading || isAnyReferenceOverlayLoading) && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
            <div
              aria-live="polite"
              aria-label={t("loadingGeeLayer")}
              className="flex items-center gap-3 rounded-full border border-white/25 bg-stone-950/78 px-5 py-3 text-sm font-medium text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm"
              role="status"
            >
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
              />
              <span>{t("loadingMapLayer")}</span>
            </div>
          </div>
        )}
      </div>

      <div className="absolute bottom-0 right-6 z-[1000] box-border flex min-h-[124px] w-[302px] flex-col items-end justify-center gap-[10px] pb-6">
        {showMonitoringOverlays && (
          <ReferenceOverlaysControl
            activeOverlays={referenceOverlays}
            onToggle={toggleReferenceOverlay}
          />
        )}
        {showMonitoringOverlays && (
          <BasemapControl basemap={basemap} onChange={setBasemap} />
        )}
        {showMonitoringOverlays && activeEEData && (
          <LayerOpacityControl
            opacity={layerOpacity ?? 0.85}
            onChange={setLayerOpacity}
          />
        )}

        {showMonitoringOverlays && activeLegend && activeLegend.length > 0 && (
          <PlatformMapCaption legend={activeLegend} />
        )}
      </div>
    </div>
  );
}
