import citiesIndex from "@/data/citiesIndex.json";
import municipalityTerritories from "@/data/municipalityTerritories.json";
import { buildSpatialLocationKey } from "@/contracts/spatialLocationKey.mjs";
import { statesObj } from "@/utils/constants";

export type TerritoryRankingEntity = "states" | "municipalities";

export interface TerritoryRankingScope {
  entity: TerritoryRankingEntity;
  /** As chaves territoriais que entram na lista, em ordem estável. */
  locationKeys: readonly string[];
}

// O primeiro dígito do código IBGE de um município é a região dele.
const REGION_NAME_BY_IBGE_DIGIT: Record<string, string> = {
  "1": "Norte",
  "2": "Nordeste",
  "3": "Sudeste",
  "4": "Sul",
  "5": "Centro-Oeste",
};

function groupBy(entries: Iterable<[string, string]>) {
  const groups = new Map<string, string[]>();
  for (const [groupKey, value] of entries) {
    const group = groups.get(groupKey);
    if (group) group.push(value);
    else groups.set(groupKey, [value]);
  }
  return groups;
}

// As áreas operacionais das lagoas Mirim e dos Patos têm código IBGE, mas não
// são municípios: ficam fora das listas do RS e do Pampa.
const NON_MUNICIPALITY_CODES = new Set(["4300001", "4300002"]);

const municipalityCodesByState = groupBy(
  citiesIndex
    .filter((city) => !NON_MUNICIPALITY_CODES.has(city.code))
    .map((city): [string, string] => [city.uf, city.code]),
);

const statesByRegion = groupBy(
  [...municipalityCodesByState].map(([uf, codes]): [string, string] => [
    buildSpatialLocationKey("2_Regiao", REGION_NAME_BY_IBGE_DIGIT[codes[0][0]]),
    uf,
  ]),
);

// Bioma (predominante), Semiárido e ASD + Entorno, como gravado por
// scripts/build-municipality-territories.mjs.
const municipalityCodesByTerritory = groupBy(
  Object.entries(
    municipalityTerritories.municipalities as Record<string, string[]>,
  )
    .filter(([code]) => !NON_MUNICIPALITY_CODES.has(code))
    .flatMap(([code, territoryKeys]) =>
      territoryKeys.map((territoryKey): [string, string] => [
        territoryKey,
        code,
      ]),
    ),
);

/**
 * Quais territórios entram em "Territórios por classificação" de um recorte.
 *
 * Uma região lista os estados dela; um estado, bioma, Semiárido ou ASD lista os
 * municípios. O Brasil não passa por aqui, porque os estados já chegam junto
 * com o recorte nacional, e um município não tem lista.
 *
 * @example
 * getTerritoryRankingScope("2_regiao-nordeste"); // { entity: "states", locationKeys: ["al", "ba", ...] }
 * getTerritoryRankingScope("3_bioma-caatinga")?.locationKeys.length; // 1095
 */
export function getTerritoryRankingScope(
  locationKey: string,
): TerritoryRankingScope | null {
  const regionStates = statesByRegion.get(locationKey);
  if (regionStates) {
    return { entity: "states", locationKeys: regionStates };
  }

  if (locationKey in statesObj) {
    return {
      entity: "municipalities",
      locationKeys: municipalityCodesByState.get(locationKey) ?? [],
    };
  }

  const territoryCodes = municipalityCodesByTerritory.get(locationKey);
  if (territoryCodes) {
    return { entity: "municipalities", locationKeys: territoryCodes };
  }

  return null;
}
