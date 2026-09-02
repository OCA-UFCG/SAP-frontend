"use client";

import maplibregl, { type LngLatBoundsLike } from "maplibre-gl";
import type { FeatureCollection, Geometry } from "geojson";
import { captureMapCanvasPng } from "@/components/Map/captureMapCanvas";
import {
  BASE_STYLE,
  ensureMapLayers,
  ensureSpatialBoundaryLayer,
} from "@/components/Map/mapDefinitions";
import {
  CLASSIFICATION_SOURCES,
  applyClassificationFeatureStates,
  applyClassificationFillOpacity,
  ensureClassificationLayer,
  ensureClassificationOverviewLayer,
  type MunicipalityClassification,
  type MunicipalityOverviewGeoJson,
} from "@/components/Map/classificationLayers";
import { BRAZIL_RASTER_BOUNDS } from "@/components/Map/mapBounds";
import {
  buildLegendEntries,
  composeAnalysisMapImage,
  type CanvasLike,
} from "./analysisMapImage";

const CAPTURE_WIDTH = 1280;
const CAPTURE_HEIGHT = 960;
const CAPTURE_PIXEL_RATIO = 2;
const CAPTURE_PADDING = 24;
const CAPTURE_TIMEOUT_MS = 30_000;
const OSM_ATTRIBUTION = "© OpenStreetMap contributors";

export interface AnalysisMapImageOptions {
  classification: MunicipalityClassification | null;
  overviewGeoJson: MunicipalityOverviewGeoJson | null;
  boundaryGeoJson: FeatureCollection<Geometry, { name: string }> | null;
  spatialValue: string;
  allowedStateUfs: Set<string> | null;
  bounds: LngLatBoundsLike | null;
  /**
   * Opacidade escolhida na barra de transparência do mapa. A captura monta um
   * mapa próprio, fora da tela, então precisa receber o valor explicitamente —
   * senão a imagem baixada sai sempre no padrão, e não no que está na tela.
   */
  fillOpacity: number;
}

const createCaptureContainer = () => {
  const container = document.createElement("div");

  container.style.position = "fixed";
  container.style.top = "0";
  container.style.left = "-20000px";
  container.style.width = `${CAPTURE_WIDTH}px`;
  container.style.height = `${CAPTURE_HEIGHT}px`;
  container.style.pointerEvents = "none";
  container.setAttribute("aria-hidden", "true");
  document.body.appendChild(container);

  return container;
};

export const captureAnalysisMapPng = ({
  classification,
  overviewGeoJson,
  boundaryGeoJson,
  spatialValue,
  allowedStateUfs,
  bounds,
  fillOpacity,
}: AnalysisMapImageOptions): Promise<string | null> =>
  new Promise((resolve) => {
    const container = createCaptureContainer();
    const map = new maplibregl.Map({
      container,
      style: BASE_STYLE,
      bounds: bounds ?? BRAZIL_RASTER_BOUNDS,
      fitBoundsOptions: { padding: CAPTURE_PADDING, animate: false },
      interactive: false,
      attributionControl: false,
      preserveDrawingBuffer: true,
      pixelRatio: CAPTURE_PIXEL_RATIO,
    } as maplibregl.MapOptions);

    let settled = false;

    const settle = (dataUrl: string | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      resolve(dataUrl);

      window.setTimeout(() => {
        try {
          map.remove();
        } catch {}
        container.remove();
      }, 0);
    };

    const timeoutId = window.setTimeout(() => settle(null), CAPTURE_TIMEOUT_MS);

    map.on("load", () => {
      ensureMapLayers(map, "platform", true, false, null);
      ensureClassificationLayer(map);

      if (classification && overviewGeoJson) {
        ensureClassificationOverviewLayer(map, overviewGeoJson);
      }

      applyClassificationFillOpacity(map, fillOpacity);

      ensureSpatialBoundaryLayer(
        map,
        boundaryGeoJson,
        true,
        allowedStateUfs,
        spatialValue,
      );

      if (classification) {
        applyClassificationFeatureStates(
          map,
          classification,
          CLASSIFICATION_SOURCES.filter(({ source }) => map.getSource(source)),
        );
      }
    });

    map.on("webglcontextlost", () => settle(null));
    map.on("idle", () => settle(captureMapCanvasPng(map)));
  });

const loadImage = (dataUrl: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Captured PNG failed to decode"));
    image.src = dataUrl;
  });

const triggerDownload = (dataUrl: string, fileName: string) => {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = fileName;
  link.click();
};

export type MapImageTranslator = (key: string) => string;

const PRIORITY_LABEL_KEYS = [
  "priorityVeryLow",
  "priorityLow",
  "priorityMedium",
  "priorityHigh",
  "priorityVeryHigh",
] as const;

export const downloadAnalysisMapImage = async (
  options: AnalysisMapImageOptions,
  t: MapImageTranslator,
  fileName = "mapa.png",
) => {
  const capturedPng = await captureAnalysisMapPng(options);
  if (!capturedPng) {
    throw new Error("Map capture returned no image");
  }

  const image = await loadImage(capturedPng);
  const canvas = document.createElement("canvas") as unknown as CanvasLike;
  const composed = composeAnalysisMapImage(canvas, image, {
    title: t("classification"),
    entries: options.classification
      ? buildLegendEntries(PRIORITY_LABEL_KEYS.map((key) => t(key)))
      : [],
    attribution: OSM_ATTRIBUTION,
    scale: CAPTURE_PIXEL_RATIO,
  });

  if (!composed) {
    throw new Error("Browser denied a 2d canvas context");
  }

  triggerDownload(composed, fileName);
};
