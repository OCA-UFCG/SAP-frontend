"use client";

import type * as maplibregl from "maplibre-gl";
import {
  OSM_LAYER_ID,
  OSM_SOURCE_ID,
} from "@/components/Map/mapDefinitions";
import { MUNICIPALITY_SOURCE_ID } from "@/components/Map/municipalityLayers";
import { startMunicipalReportStage } from "@/utils/municipalReportMetrics";
import {
  acquireReportMap,
  markReportMapUnusable,
  releaseReportMap,
} from "@/components/MunicipalReport/reportMapPool";

/** A transparência do índice sobre o mapa de fundo, a mesma do raster. */
export const REPORT_RASTER_OPACITY = 0.85;

/**
 * Quanto o desenho do fundo e dos contornos pode levar. Ele é feito uma vez
 * para todos os mapas do relatório: travado, prenderia todos de uma vez, então
 * desiste antes do prazo de cada mapa e deixa a fila tentar de novo.
 */
export const REPORT_MAP_SCENE_TIMEOUT_MS = 20_000;

type Bounds = [west: number, south: number, east: number, north: number];

/**
 * O que é igual em todos os mapas de um relatório de município: o mapa de fundo,
 * as divisas (e o véu sobre os vizinhos, quando recortado) e onde a miniatura
 * do Earth Engine cai no quadro.
 */
export interface ReportMapScene {
  /** O mapa de fundo, que fica embaixo do índice. */
  base: HTMLCanvasElement;
  /** Divisas e véu, sobre fundo transparente, que ficam em cima do índice. */
  overlay: HTMLCanvasElement;
  /** Onde a miniatura é desenhada, em pixels do canvas. */
  thumbnailRect: { x: number; y: number; width: number; height: number };
}

export interface ReportMapSceneRequest {
  /** Identifica o cenário: território, recorte e tamanho do quadro. */
  key: string;
  /** Tamanho do quadro, em pixels CSS. */
  width: number;
  height: number;
  /** O retângulo da miniatura, o mesmo pedido ao Earth Engine. */
  thumbnailBbox: Bounds;
  /** Enquadra e destaca o território, como o mapa de cada camada fazia. */
  prepare: (map: maplibregl.Map) => void;
}

const scenes = new Map<string, Promise<ReportMapScene | null>>();

/**
 * O cenário dos mapas de um relatório de município, desenhado uma vez só.
 *
 * Antes, cada um dos ~35 mapas do Earth Engine montava o mesmo fundo e as
 * mesmas divisas no MapLibre, cinco por vez, e esperava a miniatura chegar com
 * a vaga ocupada: a fila levava 10–12 s depois das URLs. Todos os mapas mostram
 * o mesmo recorte, então só a miniatura muda de um para outro — e ela já vem
 * do Earth Engine na grade exata do quadro, em Web Mercator.
 *
 * Quem pede o mesmo cenário recebe a mesma promessa. Uma falha sai do cache
 * para a próxima tentativa da fila desenhar de novo.
 *
 * @example
 * const [scene, image] = await Promise.all([
 *   loadReportMapScene({ key, width, height, thumbnailBbox, prepare }),
 *   loadReportMapThumbnail(thumbnail.url, signal),
 * ]);
 * if (scene && image) composeReportMap(scene, image);
 */
export function loadReportMapScene(
  request: ReportMapSceneRequest,
): Promise<ReportMapScene | null> {
  const key = `${request.key}|${request.width}x${request.height}@${window.devicePixelRatio}`;
  const cached = scenes.get(key);
  if (cached) return cached;

  const scene = renderReportMapScene(request).then((result) => {
    if (!result) scenes.delete(key);
    return result;
  });
  scenes.set(key, scene);
  return scene;
}

/** Descarta os cenários guardados. Chamado quando a prévia sai da tela. */
export function clearReportMapScenes() {
  scenes.clear();
}

/**
 * Onde um retângulo em graus cai no canvas do mapa, em pixels do canvas.
 *
 * O MapLibre mede em pixels CSS; o canvas tem `devicePixelRatio` vezes mais.
 */
export function projectBoundsToCanvas(
  map: Pick<maplibregl.Map, "project" | "getCanvas" | "getContainer">,
  [west, south, east, north]: Bounds,
) {
  const scale = map.getCanvas().width / map.getContainer().clientWidth;
  const topLeft = map.project([west, north]);
  const bottomRight = map.project([east, south]);
  return {
    x: topLeft.x * scale,
    y: topLeft.y * scale,
    width: (bottomRight.x - topLeft.x) * scale,
    height: (bottomRight.y - topLeft.y) * scale,
  };
}

/**
 * Um mapa do relatório: fundo, miniatura do índice e divisas, nesta ordem e com
 * a mesma transparência e amostragem do raster no MapLibre.
 *
 * Devolve `null` quando o canvas não exporta; a fila decide se tenta de novo.
 */
export function composeReportMap(
  scene: ReportMapScene,
  thumbnail: HTMLImageElement,
): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = scene.base.width;
  canvas.height = scene.base.height;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const { x, y, width, height } = scene.thumbnailRect;
  context.drawImage(scene.base, 0, 0);
  context.globalAlpha = REPORT_RASTER_OPACITY;
  // O raster usa `raster-resampling: nearest`: cada pixel do índice continua
  // um bloco de cor, sem a borda borrada entre classes.
  context.imageSmoothingEnabled = false;
  context.drawImage(thumbnail, x, y, width, height);
  context.globalAlpha = 1;
  context.drawImage(scene.overlay, 0, 0);

  try {
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

/**
 * Baixa a miniatura do Earth Engine. Começa junto com o cenário, e não depois
 * dele: as duas esperas são independentes. `null` quando ela não chega.
 */
export function loadReportMapThumbnail(url: string, signal: AbortSignal) {
  return new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    // Sem CORS o canvas fica contaminado e não exporta o PNG.
    image.crossOrigin = "anonymous";
    const settle = (result: HTMLImageElement | null) => {
      signal.removeEventListener("abort", handleAbort);
      resolve(result);
    };
    const handleAbort = () => {
      image.src = "";
      settle(null);
    };
    image.onload = () => settle(image);
    image.onerror = () => settle(null);
    signal.addEventListener("abort", handleAbort);
    image.src = url;
  });
}

function copyCanvas(source: HTMLCanvasElement) {
  const copy = document.createElement("canvas");
  copy.width = source.width;
  copy.height = source.height;
  copy.getContext("2d")?.drawImage(source, 0, 0);
  return copy;
}

function isSceneLoaded(map: maplibregl.Map) {
  return (
    map.isSourceLoaded(OSM_SOURCE_ID) &&
    map.isSourceLoaded(MUNICIPALITY_SOURCE_ID) &&
    map.areTilesLoaded()
  );
}

/**
 * Espera o mapa terminar de desenhar com o fundo e a malha carregados. O
 * redesenho pedido garante um `idle` mesmo quando o mapa já tinha parado.
 */
function waitForScene(map: maplibregl.Map, signal: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    function handleIdle() {
      if (isSceneLoaded(map)) settle(true);
    }
    function handleGiveUp() {
      settle(false);
    }
    function settle(ready: boolean) {
      map.off("idle", handleIdle);
      map.off("webglcontextlost", handleGiveUp);
      signal.removeEventListener("abort", handleGiveUp);
      resolve(ready);
    }

    map.on("idle", handleIdle);
    map.on("webglcontextlost", handleGiveUp);
    signal.addEventListener("abort", handleGiveUp);
    map.triggerRepaint();
  });
}

function setLayersVisible(
  map: maplibregl.Map,
  isVisible: (layerId: string) => boolean,
) {
  for (const { id } of map.getStyle().layers) {
    map.setLayoutProperty(id, "visibility", isVisible(id) ? "visible" : "none");
  }
}

/**
 * Fora da tela, mas no documento e com o tamanho do quadro: um contêiner solto
 * tem largura zero e o MapLibre nasce com o canvas vazio.
 */
function createOffscreenSlot(width: number, height: number) {
  const slot = document.createElement("div");
  Object.assign(slot.style, {
    position: "fixed",
    left: "-100000px",
    top: "0",
    width: `${width}px`,
    height: `${height}px`,
    pointerEvents: "none",
  });
  slot.setAttribute("aria-hidden", "true");
  document.body.appendChild(slot);
  return slot;
}

async function renderReportMapScene({
  width,
  height,
  thumbnailBbox,
  prepare,
}: ReportMapSceneRequest): Promise<ReportMapScene | null> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    REPORT_MAP_SCENE_TIMEOUT_MS,
  );
  const slot = createOffscreenSlot(width, height);
  const finishAcquire = startMunicipalReportStage();
  const pooled = await acquireReportMap(slot, controller.signal);
  const { map } = pooled;
  let completed = false;

  try {
    if (!pooled.prepared || controller.signal.aborted) return null;
    finishAcquire("Fundo dos mapas: obtenção do mapa", {
      detalhes: pooled.created
        ? "Instância nova do MapLibre e malha municipal"
        : "Instância reaproveitada da estante do relatório",
    });

    const finishTiles = startMunicipalReportStage();
    prepare(map);
    if (!(await waitForScene(map, controller.signal))) return null;
    finishTiles("Fundo dos mapas: tiles e renderização", {
      detalhes: "Mapa de fundo e malha municipal do recorte",
    });
    const thumbnailRect = projectBoundsToCanvas(map, thumbnailBbox);

    const finishLayers = startMunicipalReportStage();

    // Só o fundo: o que fica embaixo do índice.
    setLayersVisible(map, (layerId) => layerId === OSM_LAYER_ID);
    if (!(await waitForScene(map, controller.signal))) return null;
    const base = copyCanvas(map.getCanvas());

    // Tudo menos o fundo: divisas e véu, que ficam em cima do índice. O canvas
    // do MapLibre é transparente onde nada é desenhado.
    setLayersVisible(map, (layerId) => layerId !== OSM_LAYER_ID);
    if (!(await waitForScene(map, controller.signal))) return null;
    const overlay = copyCanvas(map.getCanvas());
    finishLayers("Fundo dos mapas: fundo e divisas separados", {
      detalhes: "Dois redesenhos: só o fundo, depois só as divisas",
    });

    completed = true;
    return { base, overlay, thumbnailRect };
  } catch (error) {
    console.warn("[municipalReport] falha ao desenhar o fundo dos mapas", error);
    return null;
  } finally {
    clearTimeout(timer);
    try {
      if (pooled.prepared) setLayersVisible(map, () => true);
    } catch {
      // Cai no descarte abaixo.
      completed = false;
    }
    // Um mapa que travou ou perdeu o contexto não volta para a estante.
    if (!completed) markReportMapUnusable(map);
    releaseReportMap(pooled);
    slot.remove();
  }
}
