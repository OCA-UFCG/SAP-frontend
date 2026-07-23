"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import { useEarthEngineTileLayer } from "./useEarthEngineTileLayer";
import MapComponent from "../Map/MapComponent";
import type { BasemapId } from "../Map/Map";
import {
  useMapLayerActions,
  useMapLayerActiveState,
  useMapLayerViewState,
} from "@/components/MapLayerContext/MapLayerContext";

interface PlatformMapProps {
  showMonitoringOverlays?: boolean;
}

export function PlatformMap({ showMonitoringOverlays = true }: PlatformMapProps) {
  const t = useTranslations("PlatformMap");
  const { activeData, activeEEData } = useMapLayerActiveState();
  const {
    activeLegend,
    selectedState,
    selectedMunicipalityCode,
    activeYear,
    layerOpacity,
  } = useMapLayerViewState();
  const { setSelectedState, setSelectedMunicipalityCode, setLayerOpacity } =
    useMapLayerActions();
  const { requestKey, status, tileLayerUrl } = useEarthEngineTileLayer(
    activeEEData,
    activeYear,
  );
  const [readyRequestKey, setReadyRequestKey] = useState<string | null>(null);
  const [basemap, setBasemap] = useState<BasemapId>("osm");

  const handleTileLayerReady = useCallback((readyRequestKey: string) => {
    setReadyRequestKey((current) =>
      current === readyRequestKey ? current : readyRequestKey,
    );
  }, []);

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
          basemap={basemap}
          onStateSelect={(uf: string) => setSelectedState(uf.toLowerCase())}
          onSelectedMunicipalityCodeChange={setSelectedMunicipalityCode}
          onTileLayerReady={handleTileLayerReady}
        />

        {isGeeLayerLoading && (
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
        <button
          onClick={() => setBasemap(basemap === "osm" ? "satellite" : "osm")}
          className="flex h-9 items-center gap-1.5 rounded-md border border-white/30 bg-stone-950/70 px-3 text-xs font-medium text-white shadow-lg backdrop-blur-sm transition hover:bg-stone-950/85"
          aria-label={basemap === "osm" ? t("switchToSatellite") : t("switchToOsm")}
        >
{basemap === "osm" ? t("satellite") : t("street")}
        </button>
        {showMonitoringOverlays && activeEEData && (
          <div className="box-border flex h-[50px] w-[302px] shrink-0 flex-col items-center gap-2 self-stretch rounded-lg border border-[#EFEFEF] bg-white p-4">
            <div className="flex h-[18px] w-[270px] shrink-0 items-center justify-center gap-2">
              <span className="h-[18px] w-[66px] shrink-0 font-open-sans text-[10px] font-normal leading-[18px] tracking-[-0.006em] text-[#292829]">
                {t("opacity")}
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={layerOpacity ?? 0.85}
                aria-label={t("opacity")}
                onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
                className="h-2 w-[168px] shrink-0 cursor-pointer appearance-none rounded-[40px] bg-[#F1F5F9] [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#989F43] [&::-moz-range-thumb]:bg-white [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-[40px] [&::-moz-range-track]:bg-[#F1F5F9] [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#989F43] [&::-webkit-slider-thumb]:bg-white"
              />
              <span className="h-[18px] w-5 shrink-0 font-open-sans text-[10px] font-normal leading-[18px] tracking-[-0.006em] text-[#292829]">
                {Math.round((layerOpacity ?? 0.85) * 100)}%
              </span>
            </div>
          </div>
        )}

        {showMonitoringOverlays && activeLegend && activeLegend.length > 0 && (
          <PlatformMapCaption legend={activeLegend} />
        )}
      </div>
    </div>
  );
}
