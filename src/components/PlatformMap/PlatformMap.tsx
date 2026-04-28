"use client";
import { useCallback, useState } from "react";
import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import { useEarthEngineTileLayer } from "./useEarthEngineTileLayer";
import MapComponent from "../Map/MapComponent";
import {
  useMapLayerActions,
  useMapLayerActiveState,
  useMapLayerViewState,
} from "@/components/MapLayerContext/MapLayerContext";

export function PlatformMap() {
  const { activeData, activeEEData } = useMapLayerActiveState();
  const { activeLegend, selectedState, activeYear } = useMapLayerViewState();
  const { setSelectedState } = useMapLayerActions();
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
          minZoom={3}
          center={[-15.749997, -47.9499962]}
          zoom={4}
          showStatesBorder
          dadosCDI={activeData ?? undefined}
          estadoSelecionado={selectedState.toUpperCase()}
          className="w-full h-full"
          tileLayerUrl={tileLayerUrl}
          tileLayerRequestKey={requestKey}
          onStateSelect={(uf: string) => setSelectedState(uf.toLowerCase())}
          onTileLayerReady={handleTileLayerReady}
        />

        {isGeeLayerLoading && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center px-6">
            <div
              aria-live="polite"
              aria-label="Carregando camada do GEE"
              className="flex items-center gap-3 rounded-full border border-white/25 bg-stone-950/78 px-5 py-3 text-sm font-medium text-white shadow-[0_18px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm"
              role="status"
            >
              <span
                aria-hidden="true"
                className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white"
              />
              <span>Carregando camada do mapa</span>
            </div>
          </div>
        )}
      </div>

      {/* Caption/legend overlay (bottom-right in the Figma) */}

      {activeLegend && activeLegend.length > 0 && (
        <PlatformMapCaption legend={activeLegend} />
      )}
    </div>
  );
}
