"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FeatureCollection, Geometry } from "geojson";
import type { SpatialSelection } from "@/utils/spatialScope";

type SpatialBoundaryStatus = "idle" | "loading" | "ready" | "error";

interface SpatialBoundaryOverlayResult {
  boundaryGeoJson: FeatureCollection<Geometry, { name: string }> | null;
  status: SpatialBoundaryStatus;
}

const AREAS_WITH_BOUNDARY = new Set<string>(["biome", "semiarid", "asd"]);

function needsBoundary(selection: SpatialSelection): boolean {
  return AREAS_WITH_BOUNDARY.has(selection.spatialArea);
}

function buildBoundaryCacheKey(selection: SpatialSelection): string {
  return `${selection.spatialArea}:${selection.spatialValue}`;
}

const boundaryCache = new Map<
  string,
  FeatureCollection<Geometry, { name: string }>
>();

export function useSpatialBoundaryOverlay(
  spatialSelection: SpatialSelection,
): SpatialBoundaryOverlayResult {
  const [fetchedState, setFetchedState] = useState<{
    key: string;
    geoJson: FeatureCollection<Geometry, { name: string }> | null;
    status: "ready" | "error";
  } | null>(null);

  const latestKeyRef = useRef<string | null>(null);

  const requestConfig = useMemo(() => {
    if (!needsBoundary(spatialSelection)) {
      return null;
    }
    return {
      key: buildBoundaryCacheKey(spatialSelection),
      spatialArea: spatialSelection.spatialArea,
      spatialValue: spatialSelection.spatialValue,
    };
  }, [spatialSelection]);

  useEffect(() => {
    if (!requestConfig) {
      latestKeyRef.current = null;
      return;
    }

    const { key, spatialArea, spatialValue } = requestConfig;
    latestKeyRef.current = key;

    // Check client-side cache first
    if (boundaryCache.has(key)) {
      return;
    }

    const controller = new AbortController();

    const fetchBoundary = async () => {
      try {
        const params = new URLSearchParams({ spatialArea, spatialValue });
        const response = await fetch(
          `/api/spatial-boundary?${params.toString()}`,
          { signal: controller.signal },
        );

        if (latestKeyRef.current !== key) return;

        if (!response.ok) {
          console.error(
            `Spatial boundary fetch failed: ${response.status}`,
          );
          setFetchedState({ key, geoJson: null, status: "error" });
          return;
        }

        const geoJson = (await response.json()) as FeatureCollection<
          Geometry,
          { name: string }
        >;

        if (latestKeyRef.current !== key) return;

        boundaryCache.set(key, geoJson);
        setFetchedState({ key, geoJson, status: "ready" });
      } catch (err) {
        if (controller.signal.aborted) return;
        if (latestKeyRef.current !== key) return;

        console.error("Error fetching spatial boundary:", err);
        setFetchedState({ key, geoJson: null, status: "error" });
      }
    };

    fetchBoundary();

    return () => {
      controller.abort();
    };
  }, [requestConfig]);

  if (!requestConfig) {
    return { boundaryGeoJson: null, status: "idle" };
  }

  const cached = boundaryCache.get(requestConfig.key);
  if (cached) {
    return { boundaryGeoJson: cached, status: "ready" };
  }

  if (fetchedState?.key === requestConfig.key) {
    return {
      boundaryGeoJson: fetchedState.geoJson,
      status: fetchedState.status,
    };
  }

  return { boundaryGeoJson: null, status: "loading" };
}
