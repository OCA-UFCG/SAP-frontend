import type { SpatialSelection } from "@/utils/spatialScope";
import stateClassification from "@/data/stateClassification.json";

interface StateAreas {
  region: string;
  biomes: string[];
  semiarid: boolean;
  asd: boolean;
}

const stateAreas = stateClassification as Record<string, StateAreas>;

/**
 * Returns the lowercase UFs clickable when `spatialSelection` is active,
 * or null when every state is allowed (national).
 */
export function getAllowedStateUfs(
  spatialSelection: SpatialSelection | null,
): Set<string> | null {
  if (
    !spatialSelection ||
    spatialSelection.spatialArea === "national" ||
    !spatialSelection.spatialValue
  ) {
    return null;
  }

  const { spatialArea: area, spatialValue: value } = spatialSelection;
  const allowed = new Set<string>();

  for (const [uf, areas] of Object.entries(stateAreas)) {
    const matches =
      area === "region"
        ? areas.region === value
        : area === "biome"
          ? areas.biomes.includes(value)
          : area === "semiarid"
            ? areas.semiarid
            : area === "asd"
              ? areas.asd
              : false;

    if (matches) {
      allowed.add(uf);
    }
  }

  return allowed;
}
