"use client";

import maplibregl from "maplibre-gl";
import {
  GEE_LAYER_ID,
  GEE_SOURCE_ID,
  REPORT_TERRITORY_OUTLINE_LAYER_ID,
  REPORT_TERRITORY_OUTLINE_SOURCE_ID,
} from "@/components/Map/mapDefinitions";
import {
  MUNICIPALITY_SOURCE_ID,
  MUNICIPALITY_SOURCE_LAYER,
  ensureMunicipalityLayers,
} from "@/components/Map/municipalityLayers";
import { REPORT_MAP_CAPTURE_CONCURRENCY } from "@/components/MunicipalReport/useReportMapCaptureQueue";

// O relatório desenha o índice sobre a malha municipal, sem mapa de fundo: o
// estilo nasce vazio e `ensureMunicipalityLayers` acrescenta a fonte vetorial.
const REPORT_MAP_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [],
};

// Nunca há mais mapas em uso do que a concorrência da fila, então guardar essa
// quantidade cobre o relatório inteiro sem manter contexto WebGL sobrando.
const MAX_IDLE_MAPS = REPORT_MAP_CAPTURE_CONCURRENCY;

export interface PooledReportMap {
  map: maplibregl.Map;
  container: HTMLDivElement;
  /** `true` na primeira vez que este mapa é usado, para as métricas. */
  created: boolean;
  /**
   * `false` quando o estilo não terminou de carregar, o que acontece quando a
   * fila desiste do mapa antes do evento `load`. Um mapa assim não aceita
   * `addSource`, então é descartado em vez de guardado.
   */
  prepared: boolean;
}

const idleMaps: PooledReportMap[] = [];
// Um mapa que perdeu o contexto WebGL não volta a desenhar, então não pode
// voltar para a estante — seria servido para a próxima captura já morto.
const lostMaps = new WeakSet<maplibregl.Map>();
let resourcesPrewarmed = false;

function prewarmReportMapResources() {
  if (resourcesPrewarmed) return;
  resourcesPrewarmed = true;
  maplibregl.prewarm();
}

function createContainer() {
  const container = document.createElement("div");
  container.style.width = "100%";
  container.style.height = "100%";
  return container;
}

function waitForStyle(map: maplibregl.Map, signal?: AbortSignal) {
  return new Promise<boolean>((resolve) => {
    if (signal?.aborted) {
      resolve(false);
      return;
    }

    map.on("load", () => resolve(true));
    map.on("webglcontextlost", () => {
      lostMaps.add(map);
      resolve(false);
    });
    signal?.addEventListener("abort", () => resolve(false), { once: true });
  });
}

/**
 * Um mapa pronto para capturar, montado dentro de `slot`.
 *
 * Criar uma instância do MapLibre por mapa do relatório custava, medido em
 * Juazeiro - BA com 20 mapas, 795 ms de mediana só até o evento `load` — 15,9 s
 * somados, gastos recarregando vinte vezes o mesmo estilo e a mesma malha
 * municipal. Reaproveitar a instância paga isso uma vez por vaga da fila.
 *
 * O `slot` precisa estar no documento e ter tamanho: um contêiner solto tem
 * largura zero e o MapLibre nasce com um canvas vazio.
 *
 * A promessa sempre resolve, mesmo quando o `signal` cancela no meio: quem
 * chamou precisa receber o mapa para poder devolvê-lo, senão a instância criada
 * fica órfã, ocupando um contexto WebGL que ninguém mais alcança.
 *
 * @example
 * const pooled = await acquireReportMap(containerRef.current, signal);
 */
export async function acquireReportMap(
  slot: HTMLElement,
  signal?: AbortSignal,
): Promise<PooledReportMap> {
  prewarmReportMapResources();

  const reused = idleMaps.pop();
  if (reused) {
    slot.appendChild(reused.container);
    reused.map.resize();
    return { ...reused, created: false };
  }

  const container = createContainer();
  slot.appendChild(container);
  const map = new maplibregl.Map({
    container,
    style: REPORT_MAP_STYLE,
    preserveDrawingBuffer: true,
    interactive: false,
    attributionControl: false,
  } as maplibregl.MapOptions);

  const prepared = await waitForStyle(map, signal);
  if (prepared) ensureMunicipalityLayers(map);

  return { map, container, created: true, prepared };
}

/**
 * Devolve o mapa para a estante, limpo do que a captura anterior deixou.
 *
 * A limpeza é o que torna o reaproveitamento seguro: sem remover o raster e o
 * estado do município, a captura seguinte desenharia a camada anterior por
 * cima e destacaria o município errado.
 */
export function releaseReportMap(pooled: PooledReportMap) {
  const { map, container, prepared } = pooled;

  if (prepared && !lostMaps.has(map)) {
    try {
      if (map.getLayer(GEE_LAYER_ID)) map.removeLayer(GEE_LAYER_ID);
      if (map.getSource(GEE_SOURCE_ID)) map.removeSource(GEE_SOURCE_ID);
      if (map.getLayer(REPORT_TERRITORY_OUTLINE_LAYER_ID)) {
        map.removeLayer(REPORT_TERRITORY_OUTLINE_LAYER_ID);
      }
      if (map.getSource(REPORT_TERRITORY_OUTLINE_SOURCE_ID)) {
        map.removeSource(REPORT_TERRITORY_OUTLINE_SOURCE_ID);
      }
      map.removeFeatureState({
        source: MUNICIPALITY_SOURCE_ID,
        sourceLayer: MUNICIPALITY_SOURCE_LAYER,
      });
    } catch {
      // Um mapa que não aceita mais ser limpo é um mapa que não serve para a
      // próxima captura: cai no descarte abaixo em vez de derrubar a fila.
      lostMaps.add(map);
    }
  }

  container.remove();

  if (!prepared || lostMaps.has(map) || idleMaps.length >= MAX_IDLE_MAPS) {
    map.remove();
    return;
  }

  idleMaps.push({ ...pooled, created: false });
}

/** Descarta a estante inteira. Chamado quando a prévia do relatório sai da tela. */
export function destroyReportMapPool() {
  for (const pooled of idleMaps.splice(0, idleMaps.length)) {
    pooled.container.remove();
    pooled.map.remove();
  }
}

/** Só para os testes: quantos mapas estão guardados agora. */
export function countIdleReportMaps() {
  return idleMaps.length;
}
