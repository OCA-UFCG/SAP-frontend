"use client";

import { useTranslations } from "next-intl";
import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import { MapSettingsControl } from "@/components/MapControls/MapSettingsControl";
import { ReferenceOverlaysControl } from "@/components/MapControls/ReferenceOverlaysControl";
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
  const t = useTranslations("PlatformMap");
  const {
    activeEEData,
    activeLegend,
    basemap,
    setBasemap,
    isAnyReferenceOverlayLoading,
    isGeeLayerLoading,
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
      {(isGeeLayerLoading || isAnyReferenceOverlayLoading) && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
          <div
            aria-live="polite"
            aria-label={t("loadingGeeLayer")}
            className="flex items-center gap-3 rounded-full border border-white/25 bg-stone-950/78 px-5 py-3 text-sm font-medium text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm motion-safe:animate-[panel-in_300ms_ease-out]"
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
