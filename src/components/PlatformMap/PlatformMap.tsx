"use client";
import { useEffect, useState } from "react";
import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import MapComponent from "../Map/MapComponent";
import { FeatureCollection, Geometry } from "geojson";
import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";

export interface CDIFeatureProperties {
  classe_cdi: number;
  first: number;
  [key: string]: unknown;
}
export type CDIVectorData = FeatureCollection<Geometry, CDIFeatureProperties>;

export function PlatformMap() {
  const {
    activeData,
    activeEEData,
    activeLegend,
    selectedState,
    activeYear,
  } = useMapLayer();
  const [tileLayerUrl, setTileLayerUrl] = useState<string | undefined>(
    undefined,
  );

  const visibleTileLayerUrl = activeEEData ? tileLayerUrl : undefined;

  useEffect(() => {
    if (!activeEEData) {
      return;
    }

    let cancelled = false;

    const fetchGeeUrl = async () => {
      const availableYears = Object.keys(activeEEData.imageData || {});
      if (availableYears.length > 0 && !availableYears.includes(activeYear)) {
        return; // Wait for activeYear to be updated by MapLayerContext
      }

      try {
        const res = await fetch(
          `/api/ee?name=${activeEEData.id}&year=${activeYear}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(activeEEData),
          },
        );

        const data = await res.json();
        if (cancelled) {
          return;
        }

        if (data.url) {
          setTileLayerUrl(data.url);
        } else {
          console.error("No GEE tile URL returned");
          setTileLayerUrl(undefined);
        }
      } catch (err) {
        if (cancelled) {
          return;
        }

        console.error("Error fetching GEE tile layer:", err);
        setTileLayerUrl(undefined);
      }
    };

    fetchGeeUrl();

    return () => {
      cancelled = true;
    };
  }, [activeEEData, activeYear]);

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
        />
      </div>

      {/* Caption/legend overlay (bottom-right in the Figma) */}

      {activeLegend && activeLegend.length > 0 && (
        <PlatformMapCaption legend={activeLegend} />
      )}
    </div>
  );
}
