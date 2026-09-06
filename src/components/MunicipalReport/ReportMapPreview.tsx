"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { captureMapCanvasPng } from "@/components/Map/captureMapCanvas";
import type { EeMapUrlFailure } from "@/contracts/eeMapUrls";
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

let reportMapResourcesPrewarmed = false;

/**
 * O `panelLayer` não tem imagem para o período que o relatório resolveu pelos
 * dados da análise. É conteúdo faltando, não falha momentânea, então a mensagem
 * é outra.
 */
function isMissingPeriod(reason?: EeMapUrlFailure) {
  return reason === "year_not_found" || reason === "layer_not_found";
}

function prewarmReportMapResources() {
  if (reportMapResourcesPrewarmed) return;
  reportMapResourcesPrewarmed = true;
  maplibregl.prewarm();
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
  /** URL de tiles já resolvida pelo lote do relatório. */
  tileUrl?: string;
  /**
   * Por que essa camada não trouxe URL de tiles. Preenchido significa "não
   * tente desenhar o mapa", e escolhe a mensagem que o item mostra.
   */
  unavailableReason?: EeMapUrlFailure;
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
  tileUrl,
  unavailableReason,
  onCapture,
}: ReportMapPreviewProps) {
  const t = useTranslations("MunicipalReport");
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

    function setupMapPreview() {
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
        const dataUrl = captureMapCanvasPng(map);
        finishPng(`Mapa ${layerId}: codificação PNG`, {
          detalhes: dataUrl
            ? "canvas.toDataURL(image/png)"
            : "Falha em canvas.toDataURL(image/png)",
        });
        finishCapture(dataUrl);
      });
    }

    // Sem URL de tiles não há mapa para capturar: o lote do relatório resolve
    // todas antes, e quem não tem imagem naquele período chega com `unavailable`.
    if (
      active &&
      tileUrl &&
      !unavailableReason &&
      !resolvedImageSrc &&
      !captureFailed
    ) {
      setupMapPreview();
    }

    return () => {
      aborted = true;
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
    tileUrl,
    unavailableReason,
  ]);

  // Um item sem mapa precisa dizer isso. Antes, quando a fila desistia da
  // captura, `active` voltava a ser falso e o item caía no retângulo cinza
  // mudo: o relatório saía com buracos e ninguém ficava sabendo.
  const unavailableMessage = isMissingPeriod(unavailableReason)
    ? t("mapPeriodUnavailable")
    : unavailableReason || captureFailed
      ? t("mapUnavailableExport")
      : null;

  return (
    <div
      className={`relative w-full overflow-hidden bg-[#f8f9fa] ${className ?? "h-[240px]"}`}
    >
      {resolvedImageSrc && (
        <img
          src={resolvedImageSrc}
          alt={t("mapCropAlt")}
          className="h-full w-full object-cover"
        />
      )}
      {!resolvedImageSrc && unavailableMessage && (
        <div className="flex h-full w-full items-center justify-center bg-[#eef1f1] px-4 text-center text-xs text-neutral-500">
          {unavailableMessage}
        </div>
      )}
      {!resolvedImageSrc && !unavailableMessage && active && tileUrl && (
        <div ref={containerRef} className="h-full w-full" />
      )}
      {!resolvedImageSrc && !unavailableMessage && !(active && tileUrl) && (
        <div className="h-full w-full bg-[#eef1f1]" aria-hidden="true" />
      )}
    </div>
  );
}
