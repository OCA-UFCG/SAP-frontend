"use client";
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
  const visibleTileLayerUrl = useEarthEngineTileLayer(activeEEData, activeYear);

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
          tileLayerUrl={visibleTileLayerUrl}
          onStateSelect={(uf: string) => setSelectedState(uf.toLowerCase())}
        />
      </div>

      {/* Caption/legend overlay (bottom-right in the Figma) */}

      {activeLegend && activeLegend.length > 0 && (
        <PlatformMapCaption legend={activeLegend} />
      )}
    </div>
  );
}
