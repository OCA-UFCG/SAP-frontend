"use client";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import { useEarthEngineTileLayer } from "./useEarthEngineTileLayer";
import MapComponent from "../Map/MapComponent";
import {
  useMapLayerActions,
  useMapLayerActiveState,
  useMapLayerViewState,
} from "@/components/MapLayerContext/MapLayerContext";

export function PlatformMap() {
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

      {/* Caption/legend overlay (bottom-right in the Figma) */}

      {/* Opacity slider overlay (top-right of map) */}
      {activeEEData && (
        <div className="absolute top-6 right-6 z-[1000] flex items-center gap-3 rounded-xl border border-neutral-200 bg-white/95 px-4 py-2.5 shadow-md backdrop-blur-sm">
          <span className="text-xs font-semibold text-neutral-700">
            Transparência
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={layerOpacity ?? 0.85}
            onChange={(e) => setLayerOpacity(parseFloat(e.target.value))}
            className="h-1.5 w-28 cursor-pointer appearance-none rounded-lg bg-neutral-300 accent-emerald-600"
          />
          <span className="w-9 text-right font-mono text-xs text-neutral-600">
            {Math.round((layerOpacity ?? 0.85) * 100)}%
          </span>
        </div>
      )}

      {activeLegend && activeLegend.length > 0 && (
        <PlatformMapCaption legend={activeLegend} />
      )}
    </div>
  );
}
