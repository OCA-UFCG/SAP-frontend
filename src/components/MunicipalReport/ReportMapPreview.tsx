"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchMapURL } from "@/services/mapServices";
import {
  BASE_STYLE,
  GEE_LAYER_ID,
  GEE_SOURCE_ID,
} from "@/components/Map/mapDefinitions";
import {
  MAP_MUNICIPALITY_FOCUS_MAX_ZOOM,
  resolveMunicipalitySelectionBounds,
} from "@/components/Map/mapBounds";
import {
  MUNICIPALITY_BORDER_LAYER_ID,
  MUNICIPALITY_SOURCE_ID,
  MUNICIPALITY_SOURCE_LAYER,
  ensureMunicipalityLayers,
} from "@/components/Map/municipalityLayers";

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
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const resolvedImageSrc = capturedImageSrc ?? imageSrc;

  useEffect(() => {
    let aborted = false;

    async function setupMapPreview() {
      const tileUrl = await fetchMapURL(layerId, period);
      if (aborted || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: BASE_STYLE,
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

        const bounds = resolveMunicipalitySelectionBounds(
          map,
          municipalityCode,
        );
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
            setImageSrc(dataUrl);
            onCapture?.(dataUrl);
          }
        } catch {
          setImageSrc(null);
          onCapture?.(null);
        }
      });
    }

    if (active && !resolvedImageSrc) {
      setupMapPreview();
    }

    return () => {
      aborted = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [active, layerId, municipalityCode, onCapture, period, resolvedImageSrc]);

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#f8f9fa] ${className ?? "h-[240px]"}`}
    >
      {!resolvedImageSrc && active && (
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
    </div>
  );
}
