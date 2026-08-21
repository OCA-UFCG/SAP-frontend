import type { MapGeoJSONFeature, Map as MaplibreMap, PointLike } from "maplibre-gl";
import type { MutableRefObject } from "react";
import { useCallback } from "react";
import type { SpatialArea, SpatialSelection } from "@/utils/spatialScope";
import { SPATIAL_VALUE_OPTIONS } from "@/utils/spatialScope";
import { getStateBiomes, getStateRegion } from "@/utils/interestAreaStates";
import { SPATIAL_BOUNDARY_FILL_LAYER_ID } from "./mapDefinitions";

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

/** Verify that a biome name is a known `spatialValue` for the biome area. */
const BIOME_VALUES = new Set(
  SPATIAL_VALUE_OPTIONS.biome.map((option) => option.value),
);

/** Verify that a region name is a known `spatialValue` for the region area. */
const REGION_VALUES = new Set(
  SPATIAL_VALUE_OPTIONS.region.map((option) => option.value),
);

/**
 * Resolves whether a map click should intercept spatial scope navigation.
 *
 * Biome mode:
 *   – Searches rendered boundary features for any biome name different from spatialValue.
 *   – Fallback: checks the clicked state's UF to find a biome different from spatialValue.
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
        const map = mapRef.current;
        let clickedBiomeName: string | undefined;

        if (map && map.getLayer(SPATIAL_BOUNDARY_FILL_LAYER_ID)) {
          const features = map.queryRenderedFeatures(clickPoint, {
            layers: [SPATIAL_BOUNDARY_FILL_LAYER_ID],
          }) as MapGeoJSONFeature[];

          // 1. If the active biome feature is rendered under clickPoint, block click
          const activeFeature = features.find(
            (f) => f.properties?.name === spatialValue,
          );
          if (activeFeature) {
            return "block";
          }

          // 2. Look for any other rendered biome feature at clickPoint
          const otherFeature = features.find(
            (f) => f.properties?.name && BIOME_VALUES.has(f.properties.name),
          );

          if (otherFeature) {
            clickedBiomeName = otherFeature.properties?.name as string;
          }
        }

        // 3. Fallback: check clicked state's UF
        if (!clickedBiomeName && clickedUf) {
          const stateBiomes = getStateBiomes(clickedUf);

          // If the clicked state belongs to the active biome, do nothing
          if (stateBiomes.includes(spatialValue)) {
            return "block";
          }

          clickedBiomeName = stateBiomes.find((b) => BIOME_VALUES.has(b));
        }

        if (clickedBiomeName && clickedBiomeName !== spatialValue) {
          return {
            spatialArea: "biome",
            spatialValue: clickedBiomeName,
          } as SpatialSelection;
        }

        // Same biome or click outside any biome boundary → block state selection
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
