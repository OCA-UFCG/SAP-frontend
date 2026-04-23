"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { PlatformMapCaption } from "@/components/PlatformMapCaption/PlatformMapCaption";
import MapComponent from "../Map/MapComponent";
import { FeatureCollection, Geometry } from "geojson";
import { useMapLayer } from "@/components/MapLayerContext/MapLayerContext";
import { getImageDataYearKeys } from "@/utils/imageData";

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
    setSelectedState,
  } = useMapLayer();
  const [tileLayer, setTileLayer] = useState<{
    key: string;
    url: string;
  } | null>(null);
  const latestRequestKeyRef = useRef<string | null>(null);

  const activeEeKey = useMemo(() => {
    if (!activeEEData) return null;
    return `${activeEEData.id}:${activeYear}`;
  }, [activeEEData, activeYear]);

  // Only show tiles when they correspond to the currently selected EE layer + year.
  const visibleTileLayerUrl =
    activeEeKey && tileLayer?.key === activeEeKey ? tileLayer.url : undefined;

  useEffect(() => {
    if (!activeEEData) return;

    const requestKey = `${activeEEData.id}:${activeYear}`;
    latestRequestKeyRef.current = requestKey;

    const controller = new AbortController();

    const fetchGeeUrl = async () => {
      const availableYears = getImageDataYearKeys(activeEEData.imageData);
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
            signal: controller.signal,
          },
        );

        const data = await res.json();
        if (latestRequestKeyRef.current !== requestKey) return;

        if (data.url) {
          setTileLayer({ key: requestKey, url: data.url });
        } else {
          console.error("No GEE tile URL returned");
          setTileLayer(null);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (latestRequestKeyRef.current !== requestKey) return;

        console.error("Error fetching GEE tile layer:", err);
        setTileLayer(null);
      }
    };

    fetchGeeUrl();

    return () => {
      controller.abort();
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
