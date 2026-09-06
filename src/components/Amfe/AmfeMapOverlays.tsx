"use client";

import { useTranslations } from "next-intl";
import { BasemapControl } from "@/components/MapControls/BasemapControl";
import { LayerOpacityControl } from "@/components/MapControls/LayerOpacityControl";
import { ReferenceOverlaysControl } from "@/components/MapControls/ReferenceOverlaysControl";
import { AmfeMapDownloadMenu } from "./AmfeMapDownloadMenu";
import { AmfeMapLegend } from "./AmfeMapLegend";
import { useAmfeAnalysis } from "./AmfeAnalysisContext";

/** Controles e avisos que ficam por cima do mapa enquanto Análise está aberta. */
export function AmfeMapOverlays() {
  const t = useTranslations("Analyze");
  const tMap = useTranslations("Map");
  const {
    cities,
    formPayload,
    imageOptions,
    loading,
    basemap,
    setBasemap,
    fillOpacity,
    setFillOpacity,
    referenceOverlays,
    toggleReferenceOverlay,
    municipalityClassification,
    isClassificationBelowZoomFloor,
  } = useAmfeAnalysis();

  return (
    <>
      <AmfeMapDownloadMenu
        cities={cities}
        payload={formPayload}
        imageOptions={imageOptions}
      />

      <div className="absolute bottom-0 right-6 z-[1000] box-border flex w-[302px] flex-col items-end gap-[10px] pb-6">
        <ReferenceOverlaysControl
          activeOverlays={referenceOverlays}
          onToggle={toggleReferenceOverlay}
        />
        <BasemapControl basemap={basemap} onChange={setBasemap} />
        {municipalityClassification && (
          <LayerOpacityControl
            opacity={fillOpacity}
            onChange={setFillOpacity}
          />
        )}
        {municipalityClassification && <AmfeMapLegend />}
      </div>

      {isClassificationBelowZoomFloor && (
        <p
          role="status"
          className="absolute bottom-4 left-4 z-[1000] max-w-xs rounded-lg bg-white/90 p-3 text-xs text-[#364153] shadow-lg"
        >
          {tMap("zoomInForClassification")}
        </p>
      )}

      {loading && (
        <div className="absolute inset-0 z-[1100] flex flex-col items-center justify-center bg-white/70 backdrop-blur-[1px]">
          <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#f3f3f3] border-t-[#989f43]" />
          <p className="mt-4 text-gray-600">{t("loading")}</p>
        </div>
      )}
    </>
  );
}
