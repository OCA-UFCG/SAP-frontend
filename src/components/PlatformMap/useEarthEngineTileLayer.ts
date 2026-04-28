"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMapURL } from "@/services/mapServices";
import { getImageDataYearKeys, resolveImageYearEntry } from "@/utils/imageData";
import type { IEEInfo } from "@/utils/interfaces";

interface TileLayerState {
  key: string;
  url: string;
}

export function useEarthEngineTileLayer(
  activeEEData: IEEInfo | null,
  activeYear: string,
) {
  const [tileLayer, setTileLayer] = useState<TileLayerState | null>(null);
  const latestRequestKeyRef = useRef<string | null>(null);

  const activeEeKey = useMemo(() => {
    if (!activeEEData) return null;
    return `${activeEEData.id}:${activeYear}`;
  }, [activeEEData, activeYear]);

  const visibleTileLayerUrl =
    activeEeKey && tileLayer?.key === activeEeKey ? tileLayer.url : undefined;

  useEffect(() => {
    if (!activeEEData) {
      latestRequestKeyRef.current = null;
      return;
    }

    const requestKey = `${activeEEData.id}:${activeYear}`;
    latestRequestKeyRef.current = requestKey;

    const controller = new AbortController();

    const fetchGeeUrl = async () => {
      const availableYears = getImageDataYearKeys(activeEEData.imageData);
      if (availableYears.length > 0 && !availableYears.includes(activeYear)) {
        return;
      }

      const yearConfig = resolveImageYearEntry(
        activeEEData.imageData,
        activeYear,
      );
      if (!yearConfig) {
        return;
      }

      try {
        const url = await fetchMapURL(
          activeEEData.id,
          activeYear,
          {
            imageId: yearConfig.imageId,
            imageParams: yearConfig.imageParams,
            minScale: activeEEData.minScale,
            maxScale: activeEEData.maxScale,
          },
          controller.signal,
        );

        if (latestRequestKeyRef.current !== requestKey) return;

        if (url) {
          setTileLayer({ key: requestKey, url });
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

  return visibleTileLayerUrl;
}
