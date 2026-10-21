import { useEffect, type RefObject } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

/**
 * As chaves de interface que o MapLibre lê para os botões e o próprio mapa.
 * Sem passá-las, o leitor de tela anunciava "Map", "Zoom in" e "Toggle
 * attribution" em inglês para todo mundo.
 */
const MAPLIBRE_UI_KEYS = {
  "Map.Title": "mapTitle",
  "NavigationControl.ZoomIn": "zoomIn",
  "NavigationControl.ZoomOut": "zoomOut",
  "NavigationControl.ResetBearing": "resetBearing",
  "AttributionControl.ToggleAttribution": "toggleAttribution",
  "AttributionControl.MapFeedback": "mapFeedback",
  "Popup.Close": "closePopup",
  "Marker.Title": "marker",
} as const;

export type MapUiStringKey =
  (typeof MAPLIBRE_UI_KEYS)[keyof typeof MAPLIBRE_UI_KEYS];

/**
 * Monta o `locale` do MapLibre a partir das traduções do SEDES.
 *
 * @example
 * new maplibregl.Map({ ..., locale: buildMapLibreLocale((key) => t(key)) });
 */
export function buildMapLibreLocale(
  translate: (key: MapUiStringKey) => string,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(MAPLIBRE_UI_KEYS).map(([maplibreKey, key]) => [
      maplibreKey,
      translate(key),
    ]),
  );
}

/**
 * O nome do mapa para o leitor de tela: o que está pintado e onde. "Mapa" sozinho
 * não diz nada a quem não vê se a camada ligada é a seca ou a vegetação.
 *
 * @example
 * describeMapView({ base: "Mapa", layerName: "Monitor de Secas", territoryName: "Paraíba" });
 * // "Mapa: Monitor de Secas, Paraíba"
 */
export function describeMapView({
  base,
  layerName,
  territoryName,
}: {
  base: string;
  layerName?: string | null;
  territoryName?: string | null;
}): string {
  const details = [layerName, territoryName]
    .map((part) => part?.trim())
    .filter(Boolean);
  return details.length > 0 ? `${base}: ${details.join(", ")}` : base;
}

/**
 * Mantém o nome e a descrição do `<canvas>` do MapLibre em dia com a camada e
 * o recorte. O canvas é o elemento que recebe o foco (e as setas do teclado),
 * então é ele que precisa dizer o que mostra.
 *
 * @example
 * useMapCanvasLabel(mapRef, mapInstanceVersion, "Mapa: Monitor de Secas", hintId);
 */
export function useMapCanvasLabel(
  mapRef: RefObject<MapLibreMap | null>,
  mapInstanceVersion: number,
  label: string | undefined,
  descriptionId: string,
) {
  useEffect(() => {
    const canvas = mapRef.current?.getCanvas();
    if (!canvas) return;
    if (label) canvas.setAttribute("aria-label", label);
    canvas.setAttribute("aria-describedby", descriptionId);
  }, [mapRef, mapInstanceVersion, label, descriptionId]);
}
