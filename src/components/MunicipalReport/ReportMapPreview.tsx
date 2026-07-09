"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchMapURL } from "@/services/mapServices";
import {
  GEE_LAYER_ID,
  GEE_SOURCE_ID,
} from "@/components/Map/mapDefinitions";
import {
  BRAZIL_RASTER_BOUNDS,
  getIndexedMunicipalityBounds,
  MAP_MUNICIPALITY_FOCUS_MAX_ZOOM,
} from "@/components/Map/mapBounds";
import {
  MUNICIPALITY_BORDER_LAYER_ID,
  MUNICIPALITY_SOURCE_ID,
  MUNICIPALITY_SOURCE_LAYER,
  ensureMunicipalityLayers,
} from "@/components/Map/municipalityLayers";

const REPORT_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [],
};

const tileUrlCache = new Map<string, string | null>();

async function resolveReportTileUrl(
  layerId: string,
  period: string,
  signal: AbortSignal,
) {
  const key = `${layerId}:${period}`;
  if (tileUrlCache.has(key)) return tileUrlCache.get(key) ?? null;
  const tileUrl = await fetchMapURL(layerId, period, signal);
  tileUrlCache.set(key, tileUrl);
  return tileUrl;
}

interface ReportMapPreviewProps {
  municipalityCode: string;
  layerId: string;
  period: string;
  className?: string;
  active?: boolean;
  imageSrc?: string;
  onCapture?: (src: string | null) => void;
}

export function ReportMapPreview({
  municipalityCode,
  layerId,
  period,
  className,
  active = true,
  imageSrc: capturedImageSrc,
  onCapture,
}: ReportMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const captureCompletedRef = useRef(false);
  const imageKey = `${municipalityCode}:${layerId}:${period}`;
  const [image, setImage] = useState<{ key: string; src: string } | null>(null);
  const [failedImageKey, setFailedImageKey] = useState<string | null>(null);
  const localImageSrc = image?.key === imageKey ? image.src : null;
  const resolvedImageSrc = capturedImageSrc ?? localImageSrc;
  const captureFailed = failedImageKey === imageKey;

  useEffect(() => {
    let aborted = false;
    const controller = new AbortController();

    const finishCapture = (src: string | null) => {
      if (aborted || captureCompletedRef.current) return;
      captureCompletedRef.current = true;
      if (src) {
        setImage({ key: imageKey, src });
        setFailedImageKey(null);
      } else {
        setFailedImageKey(imageKey);
      }
      onCapture?.(src);
    };

    async function setupMapPreview() {
      captureCompletedRef.current = false;
      const tileUrl = await resolveReportTileUrl(
        layerId,
        period,
        controller.signal,
      );
      if (aborted || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: REPORT_MAP_STYLE,
        preserveDrawingBuffer: true,
        interactive: false,
        attributionControl: false,
      } as maplibregl.MapOptions);

      mapRef.current = map;

      map.on("load", () => {
        if (aborted) return;

        ensureMunicipalityLayers(map);

        if (tileUrl) {
          map.addSource(GEE_SOURCE_ID, {
            type: "raster",
            tiles: [tileUrl],
            tileSize: 256,
            bounds: BRAZIL_RASTER_BOUNDS,
          });

          map.addLayer(
            {
              id: GEE_LAYER_ID,
              type: "raster",
              source: GEE_SOURCE_ID,
              paint: {
                "raster-opacity": 0.85,
                "raster-resampling": "nearest",
              },
            },
            MUNICIPALITY_BORDER_LAYER_ID,
          );
        }

        const bounds = getIndexedMunicipalityBounds(municipalityCode);
        if (bounds) {
          map.fitBounds(bounds, {
            padding: 36,
            maxZoom: MAP_MUNICIPALITY_FOCUS_MAX_ZOOM,
            animate: false,
          });
        }

        map.setFeatureState(
          {
            source: MUNICIPALITY_SOURCE_ID,
            sourceLayer: MUNICIPALITY_SOURCE_LAYER,
            id: municipalityCode,
          },
          { selected: true },
        );

        map.setFeatureState(
          {
            source: MUNICIPALITY_SOURCE_ID,
            sourceLayer: MUNICIPALITY_SOURCE_LAYER,
            id: Number(municipalityCode),
          },
          { selected: true },
        );
      });

      map.on("idle", () => {
        if (aborted) return;
        try {
          const dataUrl = map.getCanvas().toDataURL("image/png");
          if (dataUrl && dataUrl.length > 100) {
            finishCapture(dataUrl);
          } else {
            finishCapture(null);
          }
        } catch {
          finishCapture(null);
        }
      });
    }

    if (active && !resolvedImageSrc && !captureFailed) {
      setupMapPreview().catch((reason) => {
        if (reason instanceof DOMException && reason.name === "AbortError") {
          return;
        }
        finishCapture(null);
      });
    }

    return () => {
      aborted = true;
      controller.abort();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [
    active,
    captureFailed,
    imageKey,
    layerId,
    municipalityCode,
    onCapture,
    period,
    resolvedImageSrc,
  ]);

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#f8f9fa] ${className ?? "h-[240px]"}`}
    >
      {!resolvedImageSrc && active && !captureFailed && (
        <div ref={containerRef} className="h-full w-full" />
      )}
      {resolvedImageSrc && (
        <img
          src={resolvedImageSrc}
          alt="Recorte do mapa do município"
          className="h-full w-full object-cover"
        />
      )}
      {!resolvedImageSrc && !active && (
        <div className="h-full w-full bg-[#eef1f1]" aria-hidden="true" />
      )}
      {!resolvedImageSrc && active && captureFailed && (
        <div className="flex h-full w-full items-center justify-center bg-[#eef1f1] px-4 text-center text-xs text-neutral-500">
          Mapa indisponível para exportação.
        </div>
      )}
    </div>
  );
}
