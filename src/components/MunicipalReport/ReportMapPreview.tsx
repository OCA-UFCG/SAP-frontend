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
  ensureIndexChoroplethLayers,
  INDEX_CHOROPLETH_STATE_KEY,
} from "@/components/Map/indexChoroplethLayers";
import {
  MUNICIPALITY_BORDER_LAYER_ID,
  MUNICIPALITY_SOURCE_ID,
  MUNICIPALITY_SOURCE_LAYER,
} from "@/components/Map/municipalityLayers";
import {
  acquireReportMap,
  markReportMapUnusable,
  releaseReportMap,
  type PooledReportMap,
} from "@/components/MunicipalReport/reportMapPool";
import type { ReportMapThumbnail } from "@/components/MunicipalReport/reportMapView";

/**
 * Quanto uma tentativa de captura pode levar, da obtenção do mapa até o PNG.
 *
 * Um mapa leva de 2 a 4 s nas medições do relatório. Sem prazo, uma única
 * imagem que a rede nunca entrega — nem com sucesso, nem com erro — segurava o
 * relatório em "1 mapa restante" para sempre, porque a fila só tentava de novo
 * quando a captura falhava de forma explícita.
 */
export const REPORT_MAP_CAPTURE_TIMEOUT_MS = 30_000;

/**
 * Chama `onTimeout` depois de `milliseconds` com a aba visível.
 *
 * Numa aba em segundo plano o navegador para de desenhar os mapas; contar esse
 * tempo derrubaria a captura só porque o leitor foi ver outra aba enquanto o
 * relatório montava.
 */
function startVisibleTimeout(milliseconds: number, onTimeout: () => void) {
  let remaining = milliseconds;
  let startedAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function resume() {
    if (timer !== null) return;
    startedAt = Date.now();
    timer = setTimeout(onTimeout, remaining);
  }

  function pause() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
    remaining -= Date.now() - startedAt;
  }

  function handleVisibilityChange() {
    if (document.hidden) pause();
    else resume();
  }

  document.addEventListener("visibilitychange", handleVisibilityChange);
  if (!document.hidden) resume();

  return () => {
    pause();
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}

/**
 * O `panelLayer` não tem imagem para o período que o relatório resolveu pelos
 * dados da análise. É conteúdo faltando, não falha momentânea, então a mensagem
 * é outra.
 */
function isMissingPeriod(reason?: EeMapUrlFailure) {
  return reason === "year_not_found" || reason === "layer_not_found";
}

function addGeeRasterLayer(
  map: maplibregl.Map,
  source:
    maplibregl.RasterSourceSpecification | maplibregl.ImageSourceSpecification,
) {
  map.addSource(GEE_SOURCE_ID, source);

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

function tileSource(tileUrl: string): maplibregl.RasterSourceSpecification {
  return {
    type: "raster",
    tiles: [tileUrl],
    tileSize: 256,
    bounds: BRAZIL_RASTER_BOUNDS,
  };
}

/**
 * A camada inteira numa imagem só, presa aos quatro cantos do recorte. Troca os
 * ~15 tiles de cada mapa por um pedido ao Earth Engine.
 */
function thumbnailSource({
  url,
  view,
}: ReportMapThumbnail): maplibregl.ImageSourceSpecification {
  const [west, south, east, north] = view.thumbnail.bbox;
  return {
    type: "image",
    url,
    coordinates: [
      [west, north],
      [east, north],
      [east, south],
      [west, south],
    ],
  };
}

/** As faixas de um índice de planilha, pintadas município a município. */
export interface ReportMapChoropleth {
  palette: string[];
  /** Código IBGE de 7 dígitos → posição da faixa de cor. */
  classByCode: Record<string, number>;
}

/**
 * Um índice de planilha não tem asset no Earth Engine: o mapa dele é a mesma
 * coropleta do Monitoramento. Sem o GeoJSON de visão geral, porque o relatório
 * enquadra o município num zoom em que os tiles da malha já existem.
 */
function addChoroplethLayers(
  map: maplibregl.Map,
  { palette, classByCode }: ReportMapChoropleth,
) {
  ensureIndexChoroplethLayers(map, palette, null, 0.85);
  // Só a malha municipal em tiles: `applyIndexChoroplethStates` grava também na
  // fonte de visão geral, que aqui não existe, e cada um dos 5.570 municípios
  // virava um erro no console — o bastante para derrubar a aba com vários
  // mapas no relatório.
  for (const [code, classIndex] of Object.entries(classByCode)) {
    map.setFeatureState(
      {
        source: MUNICIPALITY_SOURCE_ID,
        sourceLayer: MUNICIPALITY_SOURCE_LAYER,
        id: code,
      },
      { [INDEX_CHOROPLETH_STATE_KEY]: classIndex },
    );
  }
  // A coropleta entra no topo e cobriria o contorno preto do município.
  map.moveLayer(MUNICIPALITY_BORDER_LAYER_ID);
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

function isCaptureReady(map: maplibregl.Map, sourceId: string) {
  return map.isSourceLoaded(sourceId) && map.areTilesLoaded();
}

/**
 * Espera o mapa parar de desenhar com o raster já carregado.
 *
 * Num mapa reaproveitado da estante o `idle` pode chegar antes de o raster novo
 * começar a baixar, e capturar ali devolveria a imagem da camada anterior. Por
 * isso a espera exige ter visto dados da fonte do raster **e** todos os tiles
 * carregados, em vez de confiar só no evento.
 *
 * A coropleta não tem fonte nova: ela pinta a malha municipal que o mapa já
 * tem, então basta a malha estar carregada quando o mapa parar de desenhar.
 *
 * Os ouvintes entram antes de a camada ser adicionada e antes de o território
 * ser enquadrado, porque o contorno de bioma, semiárido e ASD é buscado na
 * rede: se o raster terminasse durante essa busca, o aviso dele se perdia e a
 * espera nunca acabava. A captura, porém, só vale depois de `markFocused`,
 * senão sairia o Brasil inteiro em vez do território; o redesenho pedido ali
 * garante um `idle` mesmo quando o mapa já tinha parado.
 *
 * Ao desistir, o `signal` é o que garante a remoção dos ouvintes: o mapa volta
 * para a estante e será usado por outra camada, então um ouvinte esquecido aqui
 * ficaria pendurado nele para sempre.
 */
function waitForMapCapture(
  map: maplibregl.Map,
  signal: AbortSignal,
  choropleth: boolean,
): { ready: Promise<boolean>; markFocused: () => void } {
  const sourceId = choropleth ? MUNICIPALITY_SOURCE_ID : GEE_SOURCE_ID;
  let sourceReported = choropleth;
  let territoryFocused = false;
  let settled = false;

  const ready = new Promise<boolean>((resolve) => {
    function handleSourceData(event: maplibregl.MapSourceDataEvent) {
      if (event.sourceId === sourceId) sourceReported = true;
    }

    function handleIdle() {
      if (territoryFocused && sourceReported && isCaptureReady(map, sourceId)) {
        settle(true);
      }
    }

    function handleGiveUp() {
      settle(false);
    }

    function settle(captured: boolean) {
      settled = true;
      map.off("sourcedata", handleSourceData);
      map.off("idle", handleIdle);
      map.off("webglcontextlost", handleGiveUp);
      signal.removeEventListener("abort", handleGiveUp);
      resolve(captured);
    }

    map.on("sourcedata", handleSourceData);
    map.on("idle", handleIdle);
    map.on("webglcontextlost", handleGiveUp);
    signal.addEventListener("abort", handleGiveUp);
  });

  return {
    ready,
    markFocused() {
      if (settled) return;
      territoryFocused = true;
      map.triggerRepaint();
    },
  };
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
  /** A camada como uma imagem só do recorte, no relatório de um município. */
  thumbnail?: ReportMapThumbnail;
  /**
   * Por que essa camada não trouxe URL de tiles. Preenchido significa "não
   * tente desenhar o mapa", e escolhe a mensagem que o item mostra.
   */
  unavailableReason?: EeMapUrlFailure;
  /** Presente num índice de planilha: desenha a coropleta em vez do raster. */
  choropleth?: ReportMapChoropleth;
  onCapture?: (src: string | null) => void;
  /**
   * Pede outra tentativa de um mapa que a fila já deu como indisponível.
   * Presente, o quadro mostra o botão "Tentar novamente" junto do aviso.
   */
  onRetry?: () => void;
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
  thumbnail,
  unavailableReason,
  choropleth,
  onCapture,
  onRetry,
  onVisibilityChange,
}: ReportMapPreviewProps) {
  const drawable = Boolean(tileUrl || thumbnail || choropleth);
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
    let stopTimeout: (() => void) | null = null;
    // Mapa de uma tentativa que estourou o prazo ou lançou erro: não volta para
    // a estante, para a próxima tentativa não herdar o que travou esta.
    let unusable = false;

    const finishCapture = (src: string | null, failure?: string) => {
      if (aborted || captureCompletedRef.current) return;
      captureCompletedRef.current = true;
      stopTimeout?.();
      if (src) {
        setImage({ key: imageKey, src });
        setFailedImageKey(null);
      } else {
        setFailedImageKey(captureKey);
      }
      finishMap?.(`Mapa ${layerId} (${period})`, {
        detalhes: src
          ? "URL do Earth Engine, tiles, renderização e captura PNG"
          : (failure ?? "Mapa indisponível ou falha na captura"),
      });
      onCaptureRef.current?.(src);
    };

    // Encerra a tentativa como falha: a fila decide se tenta de novo. Abortar o
    // `controller` solta as esperas pendentes, que então saem sem fazer nada.
    const giveUp = (failure: string, error?: unknown) => {
      if (aborted || captureCompletedRef.current) return;
      unusable = true;
      controller.abort();
      console.warn(
        `[municipalReport] mapa ${layerId} (${period}): ${failure}`,
        error ?? "",
      );
      finishCapture(null, failure);
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
      if (aborted || !slot || !drawable) return;

      stopTimeout = startVisibleTimeout(REPORT_MAP_CAPTURE_TIMEOUT_MS, () =>
        giveUp(
          `Captura passou de ${REPORT_MAP_CAPTURE_TIMEOUT_MS / 1000} s sem terminar`,
        ),
      );

      const finishAcquire = startMunicipalReportStage();
      const acquired = await acquireReportMap(slot, controller.signal);
      // A limpeza do efeito já rodou e não viu este mapa, então é aqui que ele
      // volta para a estante — sem isso a instância ficaria órfã.
      if (aborted) {
        releaseReportMap(acquired);
        return;
      }
      pooled = acquired;
      if (controller.signal.aborted) return;
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
      const capture = waitForMapCapture(
        acquired.map,
        controller.signal,
        Boolean(choropleth),
      );
      if (choropleth) addChoroplethLayers(acquired.map, choropleth);
      else if (thumbnail) {
        addGeeRasterLayer(acquired.map, thumbnailSource(thumbnail));
      } else if (tileUrl) addGeeRasterLayer(acquired.map, tileSource(tileUrl));
      await focusTerritory(acquired.map, territory, controller.signal);
      if (controller.signal.aborted) return;
      // A miniatura cobre só o recorte calculado para o quadro: a câmera vai
      // exatamente para ele, em qualquer tamanho de tela.
      if (thumbnail) {
        const [west, south, east, north] = thumbnail.view.frame;
        acquired.map.fitBounds(
          [
            [west, south],
            [east, north],
          ],
          { padding: 0, animate: false },
        );
      }
      capture.markFocused();
      const ready = await capture.ready;
      if (controller.signal.aborted) return;
      finishTilesAndRender(`Mapa ${layerId}: tiles e renderização`, {
        detalhes: ready
          ? "Do raster adicionado até o mapa parar de desenhar"
          : "Contexto WebGL perdido antes da captura",
      });

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
    // A coropleta de um índice de planilha dispensa a URL.
    if (
      active &&
      drawable &&
      !unavailableReason &&
      !resolvedImageSrc &&
      !captureFailed
    ) {
      // Um erro no meio da montagem deixava o mapa pendente para sempre: a
      // promessa rejeitava sem ninguém ouvir e a fila nunca era avisada.
      setupMapPreview().catch((error) =>
        giveUp("Erro ao montar o mapa", error),
      );
    }

    return () => {
      aborted = true;
      stopTimeout?.();
      controller.abort();
      // O mapa volta para a estante em vez de ser destruído: é isso que faz o
      // item seguinte do relatório não recarregar estilo e malha municipal.
      if (pooled) {
        if (unusable) markReportMapUnusable(pooled.map);
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
    thumbnail,
    choropleth,
    drawable,
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
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[#eef1f1] px-4 text-center text-xs text-neutral-500">
          {unavailableMessage}
          {captureFailed && !active && onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="font-open-sans rounded-md bg-[#989F43] px-3 py-1 text-xs font-medium leading-5 text-white transition hover:bg-[#868D3B] print:hidden"
            >
              {t("mapRetry")}
            </button>
          )}
        </div>
      )}
      {!resolvedImageSrc && !unavailableMessage && active && drawable && (
        <div ref={containerRef} className="h-full w-full" />
      )}
      {!resolvedImageSrc && !unavailableMessage && !(active && drawable) && (
        <div className="h-full w-full bg-[#eef1f1]" aria-hidden="true" />
      )}
    </div>
  );
}
