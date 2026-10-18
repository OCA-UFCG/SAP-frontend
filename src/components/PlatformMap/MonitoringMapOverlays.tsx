"use client";

import { useEffect, useRef } from "react";
import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import { MapSettingsControl } from "@/components/MapControls/MapSettingsControl";
import { ReferenceOverlaysControl } from "@/components/MapControls/ReferenceOverlaysControl";
import { MapLayerLoading } from "./MapLayerLoading";
import { usePhoneViewport } from "./platformMapView";
import type { MonitoringMapLayers } from "./useMonitoringMapLayers";

interface MonitoringMapOverlaysProps {
  monitoring: MonitoringMapLayers;
  /** Comunicação mantém o mapa montado por baixo do relatório, sem controles. */
  showControls: boolean;
  /**
   * Quanto da borda de baixo do mapa os controles cobrem, em px. Só conta no
   * celular, onde a legenda e o botão "Mostrar opções" ocupam a largura toda.
   */
  onBottomInsetChange?: (inset: number) => void;
}

/** Controles e avisos que ficam por cima do mapa em Monitoramento. */
export function MonitoringMapOverlays({
  monitoring,
  showControls,
  onBottomInsetChange,
}: MonitoringMapOverlaysProps) {
  const isPhone = usePhoneViewport();
  const bottomStackRef = useBottomInset(isPhone, onBottomInsetChange);
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

  const referenceOverlaysControl = (
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
  );

  return (
    <>
      <MapLayerLoading
        isLoading={isGeeLayerLoading || isAnyReferenceOverlayLoading}
        dimMap={isGeeLayerLoading}
        layerName={activeEEData?.name}
        failed={hasGeeLayerFailed}
      />

      {/* No celular Territórios sobe para o canto de cima à direita, fechado
          do tamanho do rótulo: embaixo, empilhado com a legenda, cobria o Sul
          e o Nordeste. Ali em cima é oceano — a costa do Nordeste começa mais
          abaixo — e à esquerda a aba do logo do SEDES desce sobre o mapa. */}
      {showControls && isPhone && (
        <div className="absolute right-2.5 top-2 z-[1000] flex max-w-[calc(100%-20px)] flex-col items-end">
          {referenceOverlaysControl}
        </div>
      )}

      {/* No celular sobe acima do botão "Mostrar opções", que flutua embaixo. */}
      <div ref={bottomStackRef} data-stage-pop className="absolute bottom-0 right-6 z-[1000] box-border flex min-h-[124px] w-[302px] flex-col items-end justify-center gap-[10px] pb-6 max-md:right-2 max-md:min-h-0 max-md:gap-2 max-md:pb-[72px]">
        {showControls && !isPhone && referenceOverlaysControl}
        {showControls && activeLegend && activeLegend.length > 0 && (
          // Trocar de índice remonta a legenda, que entra de novo subindo.
          <div
            key={activeEEData?.id ?? "legend"}
            className="motion-safe:animate-[panel-in_420ms_cubic-bezier(0.2,0.7,0.2,1)] max-md:flex max-md:w-full max-md:flex-col max-md:items-end"
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

/**
 * Mede a pilha de baixo e avisa a altura que ela cobre, para o mapa enquadrar
 * o Brasil acima dela. Fora do celular avisa zero: no computador a pilha fica
 * no canto e o país cabe ao lado.
 */
function useBottomInset(
  isPhone: boolean,
  onBottomInsetChange?: (inset: number) => void,
) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!onBottomInsetChange) return;
    if (!isPhone || !element || typeof ResizeObserver === "undefined") {
      onBottomInsetChange(0);
      return;
    }

    const report = () =>
      onBottomInsetChange(Math.round(element.getBoundingClientRect().height));
    report();
    const observer = new ResizeObserver(report);
    observer.observe(element);
    return () => {
      observer.disconnect();
      onBottomInsetChange(0);
    };
  }, [isPhone, onBottomInsetChange]);

  return ref;
}
