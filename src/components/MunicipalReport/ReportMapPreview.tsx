"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { fetchMapURL } from "@/services/mapServices";
import { startMunicipalReportStage } from "@/utils/municipalReportMetrics";
import { GEE_LAYER_ID, GEE_SOURCE_ID } from "@/components/Map/mapDefinitions";
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
let reportMapResourcesPrewarmed = false;

function prewarmReportMapResources() {
  if (reportMapResourcesPrewarmed) return;
  reportMapResourcesPrewarmed = true;
  maplibregl.prewarm();
}

async function resolveReportTileUrl(
  layerId: string,
  period: string,
  signal: AbortSignal,
) {
  const key = `${layerId}:${period}`;
  if (tileUrlCache.has(key)) {
    return { tileUrl: tileUrlCache.get(key) ?? null, cacheHit: true };
  }
  const tileUrl = await fetchMapURL(layerId, period, signal);
  tileUrlCache.set(key, tileUrl);
  return { tileUrl, cacheHit: false };
}

interface ReportMapPreviewProps {
  municipalityCode: string;
  layerId: string;
  period: string;
  className?: string;
  active?: boolean;
  attempt?: number;
  imageSrc?: string;
  queuedAt?: number | null;
  onCapture?: (src: string | null) => void;
}

export function ReportMapPreview({
  municipalityCode,
  layerId,
  period,
  className,
  active = true,
  attempt = 0,
  imageSrc: capturedImageSrc,
  queuedAt,
  onCapture,
}: ReportMapPreviewProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const captureCompletedRef = useRef(false);
  const onCaptureRef = useRef(onCapture);
  const queueWaitRecordedKeyRef = useRef<string | null>(null);
  const imageKey = `${municipalityCode}:${layerId}:${period}`;
  const captureKey = `${imageKey}:${attempt}`;
  const [image, setImage] = useState<{ key: string; src: string } | null>(null);
  const [failedImageKey, setFailedImageKey] = useState<string | null>(null);
  const localImageSrc = image?.key === imageKey ? image.src : null;
  const resolvedImageSrc = capturedImageSrc ?? localImageSrc;
  const captureFailed = failedImageKey === captureKey;

  useEffect(() => {
    onCaptureRef.current = onCapture;
  }, [onCapture]);

  useEffect(() => {
    let aborted = false;
    let finishMap: ReturnType<typeof startMunicipalReportStage> | null = null;
    const controller = new AbortController();

    const finishCapture = (src: string | null) => {
      if (aborted || captureCompletedRef.current) return;
      captureCompletedRef.current = true;
      if (src) {
        setImage({ key: imageKey, src });
        setFailedImageKey(null);
      } else {
        setFailedImageKey(captureKey);
      }
      finishMap?.(`Mapa ${layerId} (${period})`, {
        detalhes: src
          ? "URL do Earth Engine, tiles, renderização e captura PNG"
          : "Mapa indisponível ou falha na captura",
      });
      onCaptureRef.current?.(src);
    };

    async function setupMapPreview() {
      captureCompletedRef.current = false;
      finishMap = startMunicipalReportStage();
      if (
        queuedAt !== null &&
        queuedAt !== undefined &&
        queueWaitRecordedKeyRef.current !== imageKey
      ) {
        queueWaitRecordedKeyRef.current = imageKey;
        const finishQueueWait = startMunicipalReportStage(queuedAt);
        finishQueueWait(`Mapa ${layerId}: espera na fila`, {
          detalhes: `Ativado no lote de captura com concorrência limitada`,
        });
      }

      prewarmReportMapResources();
      const finishTileUrl = startMunicipalReportStage();
      let tileUrl: string | null;
      let cacheHit: boolean;
      try {
        ({ tileUrl, cacheHit } = await resolveReportTileUrl(
          layerId,
          period,
          controller.signal,
        ));
      } catch (reason) {
        finishTileUrl(`Mapa ${layerId}: URL do Earth Engine`, {
          detalhes: "Falha na requisição POST /api/ee",
        });
        throw reason;
      }
      finishTileUrl(`Mapa ${layerId}: URL do Earth Engine`, {
        detalhes: cacheHit
          ? "Cache local do navegador"
          : "Requisição POST /api/ee",
      });
      if (aborted || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const finishMapCreation = startMunicipalReportStage();
      const map = new maplibregl.Map({
        container: containerRef.current,
        style: REPORT_MAP_STYLE,
        preserveDrawingBuffer: true,
        interactive: false,
        attributionControl: false,
      } as maplibregl.MapOptions);
      finishMapCreation(`Mapa ${layerId}: criação MapLibre`, {
        detalhes: "Construção da instância e do contexto WebGL",
      });

      mapRef.current = map;
      const finishMapLoad = startMunicipalReportStage();
      let finishTilesAndRender: ReturnType<
        typeof startMunicipalReportStage
      > | null = null;

      map.on("load", () => {
        if (aborted) return;
        finishMapLoad(`Mapa ${layerId}: inicialização MapLibre`, {
          detalhes: "Da criação da instância até o evento load",
        });
        finishTilesAndRender = startMunicipalReportStage();

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

      map.on("webglcontextlost", () => {
        finishCapture(null);
      });

      map.on("idle", () => {
        if (aborted || captureCompletedRef.current) return;
        finishTilesAndRender?.(`Mapa ${layerId}: tiles e renderização`, {
          detalhes: "Do evento load até o primeiro idle",
        });
        const finishPng = startMunicipalReportStage();
        try {
          const dataUrl = map.getCanvas().toDataURL("image/png");
          finishPng(`Mapa ${layerId}: codificação PNG`, {
            detalhes: "canvas.toDataURL(image/png)",
          });
          if (dataUrl && dataUrl.length > 100) {
            finishCapture(dataUrl);
          } else {
            finishCapture(null);
          }
        } catch {
          finishPng(`Mapa ${layerId}: codificação PNG`, {
            detalhes: "Falha em canvas.toDataURL(image/png)",
          });
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
    captureKey,
    attempt,
    imageKey,
    layerId,
    municipalityCode,
    period,
    queuedAt,
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
