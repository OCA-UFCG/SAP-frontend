"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchMapURL } from "@/services/mapServices";
import { getImageDataYearKeys, resolveImageYearEntry } from "@/utils/imageData";
import type { IEEInfo } from "@/utils/interfaces";

export type EarthEngineTileLayerStatus = "idle" | "loading" | "ready" | "error";

interface EarthEngineTileLayerResult {
  requestKey: string | null;
  status: EarthEngineTileLayerStatus;
  tileLayerUrl: string | undefined;
}

interface ResolvedTileLayerState {
  key: string | null;
  status: Exclude<EarthEngineTileLayerStatus, "idle" | "loading">;
  url: string | undefined;
}

export function useEarthEngineTileLayer(
  activeEEData: IEEInfo | null,
  activeYear: string,
): EarthEngineTileLayerResult {
  const [resolvedTileLayer, setResolvedTileLayer] =
    useState<ResolvedTileLayerState>({
      key: null,
      status: "error",
      url: undefined,
    });
  const latestRequestKeyRef = useRef<string | null>(null);

  const requestConfig = useMemo(() => {
    if (!activeEEData) {
      return null;
    }

    const availableYears = getImageDataYearKeys(activeEEData.imageData);
    if (availableYears.length > 0 && !availableYears.includes(activeYear)) {
      return null;
    }

    const yearConfig = resolveImageYearEntry(
      activeEEData.imageData,
      activeYear,
    );
    if (!yearConfig) {
      return null;
    }

    return {
      requestKey: `${activeEEData.id}:${activeYear}`,
      layerId: activeEEData.id,
      year: activeYear,
      imageId: yearConfig.imageId,
      imageParams: yearConfig.imageParams,
      minScale: activeEEData.minScale,
      maxScale: activeEEData.maxScale,
    };
  }, [activeEEData, activeYear]);

  const requestKey = requestConfig?.requestKey ?? null;

  const status = useMemo((): EarthEngineTileLayerStatus => {
    if (!requestConfig) {
      return "idle";
    }

    if (resolvedTileLayer.key !== requestConfig.requestKey) {
      return "loading";
    }

    return resolvedTileLayer.status;
  }, [requestConfig, resolvedTileLayer.key, resolvedTileLayer.status]);

  const visibleTileLayerUrl =
    requestConfig &&
    resolvedTileLayer.key === requestConfig.requestKey &&
    resolvedTileLayer.status === "ready"
      ? resolvedTileLayer.url
      : undefined;

  useEffect(() => {
    if (!requestConfig) {
      latestRequestKeyRef.current = null;
      return;
    }

    latestRequestKeyRef.current = requestConfig.requestKey;

    const controller = new AbortController();

    const fetchGeeUrl = async () => {
      try {
        const url = await fetchMapURL(
          requestConfig.layerId,
          requestConfig.year,
          {
            imageId: requestConfig.imageId,
            imageParams: requestConfig.imageParams,
            minScale: requestConfig.minScale,
            maxScale: requestConfig.maxScale,
          },
          controller.signal,
        );

        if (latestRequestKeyRef.current !== requestConfig.requestKey) return;

        if (url) {
          setResolvedTileLayer({
            key: requestConfig.requestKey,
            status: "ready",
            url,
          });
        } else {
          console.error("No GEE tile URL returned");
          setResolvedTileLayer({
            key: requestConfig.requestKey,
            status: "error",
            url: undefined,
          });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        if (latestRequestKeyRef.current !== requestConfig.requestKey) return;

        console.error("Error fetching GEE tile layer:", err);
        setResolvedTileLayer({
          key: requestConfig.requestKey,
          status: "error",
          url: undefined,
        });
      }
    };

    fetchGeeUrl();

    return () => {
      controller.abort();
    };
  }, [requestConfig]);

  return {
    requestKey,
    status,
    tileLayerUrl: visibleTileLayerUrl,
  };
}
