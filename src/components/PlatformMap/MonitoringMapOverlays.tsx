"use client";

import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import { MapSettingsControl } from "@/components/MapControls/MapSettingsControl";
import { ReferenceOverlaysControl } from "@/components/MapControls/ReferenceOverlaysControl";
import { MapLayerLoading } from "./MapLayerLoading";
import type { MonitoringMapLayers } from "./useMonitoringMapLayers";

interface MonitoringMapOverlaysProps {
  monitoring: MonitoringMapLayers;
  /** Comunicação mantém o mapa montado por baixo do relatório, sem controles. */
  showControls: boolean;
}

/** Controles e avisos que ficam por cima do mapa em Monitoramento. */
export function MonitoringMapOverlays({
  monitoring,
  showControls,
}: MonitoringMapOverlaysProps) {
  const {
    activeEEData,
    activeLegend,
    basemap,
    setBasemap,
    isAnyReferenceOverlayLoading,
    isGeeLayerLoading,
    hasGeeLayerFailed,
    layerOpacity,
    setLayerOpacity,
    referenceOverlays,
    toggleReferenceOverlay,
    highlightedReferenceOverlay,
    toggleReferenceHighlight,
    prefetchReferenceOverlays,
    focusTerritory,
    clearTerritoryFocus,
    territoryFocus,
  } = monitoring;

  return (
    <>
      <MapLayerLoading
        isLoading={isGeeLayerLoading || isAnyReferenceOverlayLoading}
        dimMap={isGeeLayerLoading}
        layerName={activeEEData?.name}
        failed={hasGeeLayerFailed}
      />

      <div data-stage-pop className="absolute bottom-0 right-6 z-[1000] box-border flex min-h-[124px] w-[302px] flex-col items-end justify-center gap-[10px] pb-6">
        {showControls && (
          <div data-tour="reference-overlays">
            <ReferenceOverlaysControl
              activeOverlays={referenceOverlays}
              onToggle={toggleReferenceOverlay}
              highlightedOverlay={highlightedReferenceOverlay}
              onToggleHighlight={toggleReferenceHighlight}
              onSelectTerritory={focusTerritory}
              selectedTerritory={territoryFocus?.territory}
              onClearTerritory={clearTerritoryFocus}
              onOpen={prefetchReferenceOverlays}
            />
          </div>
        )}
        {showControls && activeLegend && activeLegend.length > 0 && (
          // Trocar de índice remonta a legenda, que entra de novo subindo.
          <div
            key={activeEEData?.id ?? "legend"}
            className="motion-safe:animate-[panel-in_420ms_cubic-bezier(0.2,0.7,0.2,1)]"
          >
            <PlatformMapCaption legend={activeLegend} />
          </div>
        )}
      </div>

      {showControls && (
        <MapSettingsControl
          basemap={basemap}
          onBasemapChange={setBasemap}
          opacity={activeEEData ? (layerOpacity ?? 0.85) : undefined}
          onOpacityChange={activeEEData ? setLayerOpacity : undefined}
        />
      )}
    </>
  );
}
