import type { SpatialSelection } from "@/utils/spatialScope";
import stateClassification from "@/data/stateClassification.json";
import { statesObj } from "@/utils/constants";

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
        : area === "state"
          ? statesObj[uf as keyof typeof statesObj] === value
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

/**
 * Returns the region name for a given state UF (lowercase),
 * or null if the UF is not found.
 */
export function getStateRegion(uf: string): string | null {
  return stateAreas[uf.toLowerCase()]?.region ?? null;
}

/**
 * Returns the biome names a given state UF (lowercase) belongs to,
 * or an empty array if the UF is not found.
 */
export function getStateBiomes(uf: string): string[] {
  return stateAreas[uf.toLowerCase()]?.biomes ?? [];
}

/**
 * Returns all lowercase UFs that belong to a given region name.
 */
export function getRegionStateUfs(region: string): string[] {
  const ufs: string[] = [];
  for (const [uf, areas] of Object.entries(stateAreas)) {
    if (areas.region === region) {
      ufs.push(uf);
    }
  }
  return ufs;
}
