import type { IInterestedArea } from "@/utils/interfaces";
import stateClassification from "@/data/stateClassification.json";

interface StateAreas {
  region: string;
  biomes: string[];
  semiarid: boolean;
  asd: boolean;
}

const stateAreas = stateClassification as Record<string, StateAreas>;

/**
 * Returns the lowercase UFs clickable when `interestedArea` is active,
 * or null when every state is allowed (national).
 */
export function getAllowedStateUfs(
  interestedArea: IInterestedArea | null,
): Set<string> | null {
  if (
    !interestedArea ||
    interestedArea.interestedArea === "national" ||
    !interestedArea.interestedAreaValue
  ) {
    return null;
  }

  const { interestedArea: area, interestedAreaValue: value } = interestedArea;
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
