import type { Map as MaplibreMap, PointLike } from "maplibre-gl";
import type { MutableRefObject } from "react";
import { useCallback } from "react";
import type { SpatialArea, SpatialSelection } from "@/utils/spatialScope";
import { SPATIAL_VALUE_OPTIONS } from "@/utils/spatialScope";
import { getStateRegion } from "@/utils/interestAreaStates";
import { statesObj } from "@/utils/constants";
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

/** Verify that a state name is a known `spatialValue` for the state area. */
const STATE_VALUES = new Set(
  SPATIAL_VALUE_OPTIONS.state.map((option) => option.value),
);

/** Nome do estado como o recorte o nomeia ("ba" -> "Bahia"), ou null. */
function resolveStateName(uf: string): string | null {
  return statesObj[uf.toLowerCase() as keyof typeof statesObj] ?? null;
}

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
 * State mode:
 *   – Clicking another state troca o recorte para esse estado, do mesmo jeito
 *     que o clique troca de bioma em modo bioma. Sem isso o recorte por estado
 *     só podia ser trocado pelo seletor do painel.
 *   – If the same state → returns null (allows the usual state selection).
 *
 * Semiarid mode:
 *   – Returns "block": o semiárido é um recorte único, e selecionar um estado
 *     dentro dele mudaria a análise para um território que não é o recorte.
 *
 * Other modes (national, asd):
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

      // --- State mode ---
      if (spatialArea === "state" && clickedUf) {
        const clickedState = resolveStateName(clickedUf);

        if (
          clickedState &&
          STATE_VALUES.has(clickedState) &&
          clickedState !== spatialValue
        ) {
          return {
            spatialArea: "state",
            spatialValue: clickedState,
          } as SpatialSelection;
        }

        // Mesmo estado → segue a seleção de estado normal (zoom e municípios).
        return null;
      }

      // --- Semiarid mode ---
      if (spatialArea === "semiarid") {
        // Engole o clique: o recorte é o semiárido inteiro, e selecionar um
        // estado aqui trocaria a análise para um território fora do recorte.
        return "block";
      }

      // --- Other modes (national, asd) ---
      return null;
    },
    [mapRef, spatialAreaRef, spatialValueRef],
  );

  return { resolveSpatialClick };
}
