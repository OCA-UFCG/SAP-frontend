"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FeatureCollection, Geometry } from "geojson";
import { captureMapCanvasPng } from "@/components/Map/captureMapCanvas";
import type { EeMapUrlFailure } from "@/contracts/eeMapUrls";
import type { MunicipalReportTerritory } from "@/contracts/municipalReport";
import { getAllowedStateUfs } from "@/utils/interestAreaStates";
import { resolveReportTerritory } from "@/utils/reportTerritory";
import { selectActiveBoundaryFeatures } from "@/utils/spatialBoundaryFeatures";
import { startMunicipalReportStage } from "@/utils/municipalReportMetrics";
import {
  GEE_LAYER_ID,
  GEE_SOURCE_ID,
  REPORT_TERRITORY_OUTLINE_LAYER_ID,
  REPORT_TERRITORY_OUTLINE_SOURCE_ID,
} from "@/components/Map/mapDefinitions";
import {
  BRAZIL_RASTER_BOUNDS,
  geoBrasilSource,
  getIndexedMunicipalityBounds,
  MAP_MUNICIPALITY_FOCUS_MAX_ZOOM,
  resolveSpatialFocusBounds,
} from "@/components/Map/mapBounds";
import {
  MUNICIPALITY_BORDER_LAYER_ID,
  MUNICIPALITY_SOURCE_ID,
  MUNICIPALITY_SOURCE_LAYER,
} from "@/components/Map/municipalityLayers";
import {
  acquireReportMap,
  releaseReportMap,
  type PooledReportMap,
} from "@/components/MunicipalReport/reportMapPool";

/**
 * O `panelLayer` não tem imagem para o período que o relatório resolveu pelos
 * dados da análise. É conteúdo faltando, não falha momentânea, então a mensagem
 * é outra.
 */
function isMissingPeriod(reason?: EeMapUrlFailure) {
  return reason === "year_not_found" || reason === "layer_not_found";
}

function addGeeRasterLayer(map: maplibregl.Map, tileUrl: string) {
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
      paint: { "raster-opacity": 0.85, "raster-resampling": "nearest" },
    },
    MUNICIPALITY_BORDER_LAYER_ID,
  );
}

type OutlineCollection = FeatureCollection<Geometry, { name: string }>;

/**
 * O contorno do território do relatório, quando ele não está na malha
 * municipal.
 *
 * Bioma, semiárido e ASD vêm da mesma rota de contorno que o mapa de
 * Monitoramento usa; estado e região são desenhados a partir da malha de
 * estados que o pacote já carrega, porque não há contorno servido para eles.
 * O Brasil não precisa de nenhum: o raster já é o país inteiro.
 */
async function loadTerritoryOutline(
  territory: MunicipalReportTerritory,
  signal: AbortSignal,
): Promise<OutlineCollection | null> {
  const selection = resolveReportTerritory(territory.locationKey)?.selection;
  if (!selection || selection.spatialArea === "national") return null;

  if (selection.spatialArea === "state" || selection.spatialArea === "region") {
    const allowedUfs = getAllowedStateUfs(selection);
    if (!allowedUfs?.size) return null;
    const normalized = new Set([...allowedUfs].map((uf) => uf.toUpperCase()));

    return {
      type: "FeatureCollection",
      features: geoBrasilSource.features
        .filter((feature) =>
          normalized.has(feature.properties?.info.sigla ?? ""),
        )
        .map((feature) => ({
          type: "Feature" as const,
          geometry: feature.geometry,
          properties: { name: territory.name },
        })),
    };
  }

  const params = new URLSearchParams({
    spatialArea: selection.spatialArea,
    spatialValue: selection.spatialValue,
  });
  const response = await fetch(`/api/spatial-boundary?${params.toString()}`, {
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) return null;

  return selectActiveBoundaryFeatures(
    (await response.json()) as OutlineCollection,
    selection.spatialValue,
  );
}

function drawTerritoryOutline(map: maplibregl.Map, outline: OutlineCollection) {
  map.addSource(REPORT_TERRITORY_OUTLINE_SOURCE_ID, {
    type: "geojson",
    data: outline,
  });
  map.addLayer({
    id: REPORT_TERRITORY_OUTLINE_LAYER_ID,
    type: "line",
    source: REPORT_TERRITORY_OUTLINE_SOURCE_ID,
    paint: { "line-color": "#292829", "line-width": 1.4 },
  });
}

/**
 * Enquadra e destaca o território do relatório.
 *
 * O município continua usando a malha municipal e o `feature-state` dela; os
 * demais recortes ganham contorno próprio, porque nenhum deles existe naquela
 * malha e sem isso o mapa de um bioma sairia igual ao do Brasil.
 */
async function focusTerritory(
  map: maplibregl.Map,
  territory: MunicipalReportTerritory,
  signal: AbortSignal,
) {
  if (territory.level === "municipality") {
    focusMunicipality(map, territory.locationKey);
    return;
  }

  const outline = await loadTerritoryOutline(territory, signal).catch(
    () => null,
  );
  if (signal.aborted) return;
  if (outline?.features.length) drawTerritoryOutline(map, outline);

  const bounds = resolveSpatialFocusBounds(
    geoBrasilSource,
    null,
    outline?.features.length ? outline : null,
  );
  if (bounds) map.fitBounds(bounds, { padding: 24, animate: false });
}

function focusMunicipality(map: maplibregl.Map, municipalityCode: string) {
  const bounds = getIndexedMunicipalityBounds(municipalityCode);
  if (bounds) {
    map.fitBounds(bounds, {
      padding: 36,
      maxZoom: MAP_MUNICIPALITY_FOCUS_MAX_ZOOM,
      animate: false,
    });
  }

  // A malha promove `CD_MUN` a id, e há tabelas em que ele chega como número:
  // marcar as duas formas evita o mapa sair sem o município destacado.
  for (const id of [municipalityCode, Number(municipalityCode)]) {
    map.setFeatureState(
      {
        source: MUNICIPALITY_SOURCE_ID,
        sourceLayer: MUNICIPALITY_SOURCE_LAYER,
        id,
      },
      { selected: true },
    );
  }
}

function isRasterCaptureReady(map: maplibregl.Map) {
  return map.isSourceLoaded(GEE_SOURCE_ID) && map.areTilesLoaded();
}

/**
 * Espera o mapa parar de desenhar com o raster já carregado.
 *
 * Num mapa reaproveitado da estante o `idle` pode chegar antes de o raster novo
 * começar a baixar, e capturar ali devolveria a imagem da camada anterior. Por
 * isso a espera exige ter visto dados da fonte do raster **e** todos os tiles
 * carregados, em vez de confiar só no evento.
 *
 * Ao desistir, o `signal` é o que garante a remoção dos ouvintes: o mapa volta
 * para a estante e será usado por outra camada, então um ouvinte esquecido aqui
 * ficaria pendurado nele para sempre.
 */
function waitForRasterCapture(
  map: maplibregl.Map,
  signal: AbortSignal,
): Promise<boolean> {
  return new Promise((resolve) => {
    let rasterReported = false;

    function handleSourceData(event: maplibregl.MapSourceDataEvent) {
      if (event.sourceId === GEE_SOURCE_ID) rasterReported = true;
    }

    function handleIdle() {
      if (rasterReported && isRasterCaptureReady(map)) settle(true);
    }

    function handleGiveUp() {
      settle(false);
    }

    function settle(ready: boolean) {
      map.off("sourcedata", handleSourceData);
      map.off("idle", handleIdle);
      map.off("webglcontextlost", handleGiveUp);
      signal.removeEventListener("abort", handleGiveUp);
      resolve(ready);
    }

    map.on("sourcedata", handleSourceData);
    map.on("idle", handleIdle);
    map.on("webglcontextlost", handleGiveUp);
    signal.addEventListener("abort", handleGiveUp);
  });
}

interface ReportMapPreviewProps {
  territory: MunicipalReportTerritory;
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
  /**
   * Avisa a fila que este quadro entrou ou saiu da área visível, para que os
   * mapas que o leitor está olhando peguem as vagas primeiro.
   */
  onVisibilityChange?: (visible: boolean) => void;
}

export function ReportMapPreview({
  territory,
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
  onVisibilityChange,
}: ReportMapPreviewProps) {
  const t = useTranslations("MunicipalReport");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement | null>(null);
  const captureCompletedRef = useRef(false);
  const onCaptureRef = useRef(onCapture);
  const queueWaitRecordedKeyRef = useRef<string | null>(null);
  const imageKey = `${territory.locationKey}:${layerId}:${period}`;
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
    const frame = frameRef.current;
    if (!frame || !onVisibilityChange) return;

    // Sem `IntersectionObserver` (jsdom, navegador antigo) todo mapa conta como
    // visível: a fila volta a preencher as vagas na ordem do documento, que é o
    // comportamento anterior, em vez de travar sem nenhum mapa prioritário.
    if (typeof IntersectionObserver === "undefined") {
      onVisibilityChange(true);
      return;
    }

    // A margem adianta o mapa que está logo abaixo da dobra, porque é o
    // próximo que o leitor vai encontrar ao rolar.
    const observer = new IntersectionObserver(
      ([entry]) => onVisibilityChange(entry.isIntersecting),
      { rootMargin: "200px 0px" },
    );
    observer.observe(frame);
    return () => observer.disconnect();
  }, [onVisibilityChange]);

  useEffect(() => {
    const controller = new AbortController();
    let aborted = false;
    let finishMap: ReturnType<typeof startMunicipalReportStage> | null = null;
    let pooled: PooledReportMap | null = null;

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

      const slot = containerRef.current;
      if (aborted || !slot || !tileUrl) return;

      const finishAcquire = startMunicipalReportStage();
      const acquired = await acquireReportMap(slot, controller.signal);
      // A limpeza do efeito já rodou e não viu este mapa, então é aqui que ele
      // volta para a estante — sem isso a instância ficaria órfã.
      if (aborted) {
        releaseReportMap(acquired);
        return;
      }
      pooled = acquired;
      finishAcquire(`Mapa ${layerId}: obtenção do mapa`, {
        detalhes: acquired.created
          ? "Instância nova do MapLibre e malha municipal"
          : "Instância reaproveitada da estante do relatório",
      });
      if (!acquired.prepared) {
        finishCapture(null);
        return;
      }

      const finishTilesAndRender = startMunicipalReportStage();
      addGeeRasterLayer(acquired.map, tileUrl);
      await focusTerritory(acquired.map, territory, controller.signal);
      if (aborted) return;
      const ready = await waitForRasterCapture(acquired.map, controller.signal);
      finishTilesAndRender(`Mapa ${layerId}: tiles e renderização`, {
        detalhes: ready
          ? "Do raster adicionado até o mapa parar de desenhar"
          : "Contexto WebGL perdido antes da captura",
      });
      if (aborted) return;

      if (!ready) {
        finishCapture(null);
        return;
      }

      const finishPng = startMunicipalReportStage();
      const dataUrl = captureMapCanvasPng(acquired.map);
      finishPng(`Mapa ${layerId}: codificação PNG`, {
        detalhes: dataUrl
          ? "canvas.toDataURL(image/png)"
          : "Falha em canvas.toDataURL(image/png)",
      });
      finishCapture(dataUrl);
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
      controller.abort();
      // O mapa volta para a estante em vez de ser destruído: é isso que faz o
      // item seguinte do relatório não recarregar estilo e malha municipal.
      if (pooled) {
        releaseReportMap(pooled);
        pooled = null;
      }
    };
  }, [
    active,
    captureFailed,
    captureKey,
    attempt,
    imageKey,
    layerId,
    territory,
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
      ref={frameRef}
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
