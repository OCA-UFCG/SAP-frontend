import type { LngLatLike, Map as MaplibreMap, Popup } from "maplibre-gl";
import type { MutableRefObject } from "react";
import { getRegionStateUfs } from "@/utils/interestAreaStates";
import {
  SPATIAL_BOUNDARY_SOURCE_ID,
  STATES_SOURCE_ID,
  STATES_SOURCE_LAYER,
} from "./mapDefinitions";

/** Região destacada agora: o nome identifica, as UFs dizem o que limpar. */
export interface HoveredRegion {
  name: string;
  ufs: string[];
}

export type HoveredRegionRef = MutableRefObject<HoveredRegion | null>;
export type HoveredBoundaryRef = MutableRefObject<string | null>;

const setStatesHover = (
  map: MaplibreMap,
  ufs: readonly string[],
  hover: boolean,
) => {
  ufs.forEach((uf) => {
    map.setFeatureState(
      { source: STATES_SOURCE_ID, sourceLayer: STATES_SOURCE_LAYER, id: uf },
      { hover },
    );
  });
};

/** Apaga o destaque da região inteira; seguro de chamar sem nada destacado. */
export const clearRegionHoverPreview = (
  map: MaplibreMap | null,
  hoveredRegionRef: HoveredRegionRef,
) => {
  const hovered = hoveredRegionRef.current;
  if (!hovered) return;

  if (map) setStatesHover(map, hovered.ufs, false);
  hoveredRegionRef.current = null;
};

/**
 * Destaca todos os estados da região sob o cursor e nomeia a região no balão.
 *
 * A comparação é pelo nome da região, e não pela primeira UF da lista: as duas
 * coisas coincidem hoje só porque nenhuma UF pertence a duas regiões.
 */
export const applyRegionHoverPreview = (
  map: MaplibreMap,
  {
    regionName,
    lngLat,
    popup,
    hoveredRegionRef,
  }: {
    regionName: string;
    lngLat: LngLatLike;
    popup: Popup;
    hoveredRegionRef: HoveredRegionRef;
  },
) => {
  if (hoveredRegionRef.current?.name !== regionName) {
    clearRegionHoverPreview(map, hoveredRegionRef);

    const ufs = getRegionStateUfs(regionName).map((uf) => uf.toUpperCase());
    setStatesHover(map, ufs, true);
    hoveredRegionRef.current = { name: regionName, ufs };
  }

  map.getCanvas().style.cursor = "pointer";
  popup.setLngLat(lngLat).setText(regionName).addTo(map);
};

/** Apaga o véu escuro do contorno; seguro de chamar sem nada destacado. */
export const clearBiomeHoverPreview = (
  map: MaplibreMap | null,
  hoveredBoundaryRef: HoveredBoundaryRef,
) => {
  const hoveredName = hoveredBoundaryRef.current;
  if (!hoveredName) return;

  // `promoteId: "name"` faz o id da feature ser o próprio nome do bioma.
  map?.setFeatureState(
    { source: SPATIAL_BOUNDARY_SOURCE_ID, id: hoveredName },
    { hover: false },
  );
  hoveredBoundaryRef.current = null;
};

/** Escurece o bioma sob o cursor e nomeia o bioma no balão. */
export const applyBiomeHoverPreview = (
  map: MaplibreMap,
  {
    biomeName,
    lngLat,
    popup,
    hoveredBoundaryRef,
  }: {
    biomeName: string;
    lngLat: LngLatLike;
    popup: Popup;
    hoveredBoundaryRef: HoveredBoundaryRef;
  },
) => {
  if (hoveredBoundaryRef.current !== biomeName) {
    clearBiomeHoverPreview(map, hoveredBoundaryRef);

    map.setFeatureState(
      { source: SPATIAL_BOUNDARY_SOURCE_ID, id: biomeName },
      { hover: true },
    );
    hoveredBoundaryRef.current = biomeName;
  }

  map.getCanvas().style.cursor = "pointer";
  popup.setLngLat(lngLat).setText(biomeName).addTo(map);
};

/** Apaga o destaque de um único estado. */
export const clearStateHoverPreview = (
  map: MaplibreMap,
  hoveredStateIdRef: MutableRefObject<string | number | null>,
) => {
  if (hoveredStateIdRef.current === null) return;

  map.setFeatureState(
    {
      source: STATES_SOURCE_ID,
      sourceLayer: STATES_SOURCE_LAYER,
      id: hoveredStateIdRef.current,
    },
    { hover: false },
  );
  hoveredStateIdRef.current = null;
};
