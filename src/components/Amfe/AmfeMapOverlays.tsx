"use client";

import { useTranslations } from "next-intl";
import { MapSettingsControl } from "@/components/MapControls/MapSettingsControl";
import { ReferenceOverlaysControl } from "@/components/MapControls/ReferenceOverlaysControl";
import { AmfeMapDownloadMenu } from "./AmfeMapDownloadMenu";
import { AmfeMapLegend } from "./AmfeMapLegend";
import { useAmfeAnalysis } from "./AmfeAnalysisContext";
import { Icon } from "@/components/Icon/Icon";

/** Controles e avisos que ficam por cima do mapa enquanto Análise está aberta. */
export function AmfeMapOverlays() {
  const t = useTranslations("Analyze");
  const tMap = useTranslations("Map");
  const {
    cities,
    excludedCities,
    coverage,
    formPayload,
    imageOptions,
    loading,
    basemap,
    setBasemap,
    fillOpacity,
    setFillOpacity,
    referenceOverlays,
    toggleReferenceOverlay,
    highlightedReferenceOverlay,
    toggleReferenceHighlight,
    prefetchReferenceOverlays,
    focusTerritory,
    clearTerritoryFocus,
    territoryFocus,
    municipalityClassification,
    isClassificationBelowZoomFloor,
  } = useAmfeAnalysis();

  return (
    <>
      <AmfeMapDownloadMenu
        cities={cities}
        coverage={coverage}
        excludedCities={excludedCities}
        payload={formPayload}
        imageOptions={imageOptions}
      />

      {/* No celular sobe acima do botão "Mostrar opções", que flutua embaixo. */}
      <div data-stage-pop className="absolute bottom-0 right-6 z-[1000] box-border flex w-[302px] flex-col items-end gap-[10px] pb-6 max-md:right-2 max-md:pb-[64px]">
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
        {municipalityClassification && (
          <div className="motion-safe:animate-[panel-in_420ms_cubic-bezier(0.2,0.7,0.2,1)]">
            <AmfeMapLegend />
          </div>
        )}
      </div>

      <MapSettingsControl
        basemap={basemap}
        onBasemapChange={setBasemap}
        opacity={municipalityClassification ? fillOpacity : undefined}
        onOpacityChange={
          municipalityClassification ? setFillOpacity : undefined
        }
      />

      {isClassificationBelowZoomFloor && (
        <p
          role="status"
          className="absolute bottom-4 left-4 z-[1000] max-w-xs rounded-lg bg-white/90 p-3 text-xs text-[#364153] shadow-lg max-md:top-16 max-md:bottom-auto max-md:left-2 max-md:right-2"
        >
          {tMap("zoomInForClassification")}
        </p>
      )}

      {loading && (
        <div className="absolute inset-0 z-[1100] flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px]">
          {/* Um radar no lugar do spinner: anéis saem do alvo, o ícone da
              Priorização, enquanto os municípios são comparados. */}
          <div aria-hidden="true" className="relative flex h-24 w-24 items-center justify-center">
            {[0, 600, 1200].map((delay) => (
              <span
                key={delay}
                className="absolute inset-0 rounded-full border-2 border-[#646B2D] opacity-0 motion-safe:animate-[radar_1800ms_ease-out_infinite]"
                style={{ animationDelay: `${delay}ms` }}
              />
            ))}
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#646B2D] text-white shadow-[0_8px_20px_rgba(91,97,42,0.35)] motion-reduce:animate-pulse">
              <Icon id="target" size={24} />
            </span>
          </div>
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      )}
    </>
  );
}
