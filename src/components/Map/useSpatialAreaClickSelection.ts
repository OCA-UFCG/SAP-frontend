import type { Map as MaplibreMap, PointLike } from "maplibre-gl";
import type { MutableRefObject } from "react";
import { useCallback } from "react";
import type { SpatialArea, SpatialSelection } from "@/utils/spatialScope";
import { SPATIAL_VALUE_OPTIONS } from "@/utils/spatialScope";
import { getStateRegion } from "@/utils/interestAreaStates";
import { resolveBiomeAtPoint } from "./resolveBiomeAtPoint";

/**
 * Result of resolving a map click against the active spatial scope:
 *
 * - `SpatialSelection`  — the click landed on a different spatial area;
 *                          the caller should switch the active scope and
 *                          NOT proceed with state selection.
 * - `"block"`            — the click is inside the current spatial area but
 *                          state selection is not allowed (biome mode);
 *                          the caller should swallow the click.
 * - `null`               — the spatial scope does not intercept this click;
 *                          the caller should proceed with normal state selection.
 */
export type SpatialClickResult = SpatialSelection | "block" | null;

interface UseSpatialAreaClickSelectionArgs {
  mapRef: MutableRefObject<MaplibreMap | null>;
  spatialAreaRef: MutableRefObject<SpatialArea>;
  spatialValueRef: MutableRefObject<string>;
}

/** Verify that a region name is a known `spatialValue` for the region area. */
const REGION_VALUES = new Set(
  SPATIAL_VALUE_OPTIONS.region.map((option) => option.value),
);

/**
 * Resolves whether a map click should intercept spatial scope navigation.
 *
 * Biome mode:
 *   – Resolve o bioma sob o cursor com `resolveBiomeAtPoint`, a mesma função
 *     que alimenta o balão do hover, para o clique nunca discordar do que o
 *     usuário acabou de ler na tela.
 *   – If a different biome → returns the new SpatialSelection.
 *   – If inside same biome or click outside → returns "block" (no state selection).
 *
 * Region mode:
 *   – Uses the clicked state's UF to look up its region via stateClassification.
 *   – If a different region → returns the new SpatialSelection.
 *   – If the same region → returns null (allows state selection).
 *
 * Other modes (national, state, semiarid, asd):
 *   – Returns null (state selection proceeds normally).
 */
export function useSpatialAreaClickSelection({
  mapRef,
  spatialAreaRef,
  spatialValueRef,
}: UseSpatialAreaClickSelectionArgs) {
  const resolveSpatialClick = useCallback(
    (
      clickPoint: PointLike,
      clickedUf: string | undefined,
    ): SpatialClickResult => {
      const spatialArea = spatialAreaRef.current;
      const spatialValue = spatialValueRef.current;

      // --- Biome mode ---
      if (spatialArea === "biome") {
        const clickedBiome = resolveBiomeAtPoint(
          mapRef.current,
          clickPoint,
          clickedUf,
        );

        if (clickedBiome && clickedBiome !== spatialValue) {
          return {
            spatialArea: "biome",
            spatialValue: clickedBiome,
          } as SpatialSelection;
        }

        // Mesmo bioma ou clique fora de qualquer bioma: engole o clique, para
        // não selecionar um estado dentro de um recorte por bioma.
        return "block";
      }

      // --- Region mode ---
      if (spatialArea === "region" && clickedUf) {
        const stateRegion = getStateRegion(clickedUf);

        if (
          stateRegion &&
          REGION_VALUES.has(stateRegion) &&
          stateRegion !== spatialValue
        ) {
          return {
            spatialArea: "region",
            spatialValue: stateRegion,
          } as SpatialSelection;
        }

        // Same region → allow normal state selection
        return null;
      }

      // --- Other modes (national, state, semiarid, asd) ---
      return null;
    },
    [mapRef, spatialAreaRef, spatialValueRef],
  );

  return { resolveSpatialClick };
}
