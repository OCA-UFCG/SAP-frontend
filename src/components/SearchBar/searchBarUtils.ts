import { normalize } from "@/utils/functions";
import { searchMatchRank } from "@/utils/searchMatch";
import { states, ufs, statesObj } from "@/utils/constants";
import citiesIndex from "@/data/citiesIndex.json";
import {
  SPATIAL_VALUE_OPTIONS,
  type SpatialArea,
  type SpatialSelection,
} from "@/utils/spatialScope";

interface SearchOptionMetadata {
  label: string;
  normalizedLabel: string;
  normalizedName?: string;
  normalizedUf: string;
}

interface CitySearchOption {
  code: string;
  label: string;
  name: string;
  uf: string;
}

export const BRAZIL_OPTION = "Brasil";
export const statesNormalized = new Set(Array.from(states).map(normalize));
export const ufsNormalized = new Set(Array.from(ufs).map(normalize));
export const brazilNormalized = normalize(BRAZIL_OPTION);
export const stateOptions = [BRAZIL_OPTION, ...Array.from(states)];
export const cityOptions = citiesIndex as CitySearchOption[];
export const cityLabelsNormalized = new Set(
  cityOptions.map((city) => normalize(city.label)),
);
export const cityNamesNormalized = new Set(
  cityOptions.map((city) => normalize(city.name)),
);

export const stateOptionsMetadata: SearchOptionMetadata[] = [
  {
    label: BRAZIL_OPTION,
    normalizedLabel: brazilNormalized,
    normalizedUf: "br",
  },
  ...Object.entries(statesObj).map(([uf, label]) => ({
    label,
    normalizedLabel: normalize(label),
    normalizedUf: normalize(uf),
  })),
];

export const cityOptionsMetadata: SearchOptionMetadata[] = cityOptions.map(
  (city) => ({
    label: city.label,
    normalizedLabel: normalize(city.label),
    normalizedName: normalize(city.name),
    normalizedUf: normalize(city.uf),
  }),
);

type SpatialScopeArea = Exclude<SpatialArea, "national" | "state">;

interface SpatialScopeSearchOption {
  label: string;
  selection: SpatialSelection;
}

// Os nomes que a lista mostra. Região e bioma usam o próprio valor; Semiárido
// e ASD têm valor técnico ("semiárido", "ASD") e ganham o nome por extenso.
const SPATIAL_SCOPE_LABELS: Partial<Record<string, string>> = {
  semiárido: "Semiárido",
  ASD: "ASD e Entorno",
};

function buildSpatialScopeOptions(
  spatialArea: SpatialScopeArea,
): SpatialScopeSearchOption[] {
  return SPATIAL_VALUE_OPTIONS[spatialArea].map(({ value }) => ({
    label: SPATIAL_SCOPE_LABELS[value] ?? value,
    selection: { spatialArea, spatialValue: value } as SpatialSelection,
  }));
}

const spatialScopeOptionsByArea: Record<
  SpatialScopeArea,
  SpatialScopeSearchOption[]
> = {
  region: buildSpatialScopeOptions("region"),
  biome: buildSpatialScopeOptions("biome"),
  semiarid: buildSpatialScopeOptions("semiarid"),
  asd: buildSpatialScopeOptions("asd"),
};

const spatialScopeOptionByLabel = new Map(
  Object.values(spatialScopeOptionsByArea)
    .flat()
    .map((option) => [normalize(option.label), option]),
);

function toMetadata(options: SpatialScopeSearchOption[]): SearchOptionMetadata[] {
  return options.map((option) => ({
    label: option.label,
    normalizedLabel: normalize(option.label),
    normalizedUf: "",
  }));
}

/**
 * O recorte agregado (região, bioma, Semiárido ou ASD) com este nome, ou
 * `null` para Brasil, estados, municípios e textos desconhecidos.
 *
 * @example findSpatialScopeSearchOption("Caatinga")
 * // { spatialArea: "biome", spatialValue: "Caatinga" }
 */
export function findSpatialScopeSearchOption(
  value: string,
): SpatialSelection | null {
  return (
    spatialScopeOptionByLabel.get(normalize(value.trim()))?.selection ?? null
  );
}

// Brasil e estados primeiro, depois os demais recortes (regiões, biomas,
// Semiárido, ASD) e, por último, os municípios. Com os estados antes das
// regiões, a sigla continua levando ao estado: "ce" é Ceará, não Centro-Oeste.
export const searchOptionsMetadata = [
  ...stateOptionsMetadata,
  ...toMetadata(spatialScopeOptionsByArea.region),
  ...toMetadata(spatialScopeOptionsByArea.biome),
  ...toMetadata(spatialScopeOptionsByArea.semiarid),
  ...toMetadata(spatialScopeOptionsByArea.asd),
  ...cityOptionsMetadata,
];

function filterOptions(options: SearchOptionMetadata[], value: string) {
  const normalizedValue = normalize(value.trim());

  if (!normalizedValue) return options.map((option) => option.label);

  // Nome exato primeiro, depois quem começa com o texto: é a primeira opção
  // que o Enter escolhe. A UF continua valendo, mas só no fim da lista.
  return options
    .map((option) => ({
      option,
      rank:
        searchMatchRank(normalizedValue, [
          option.normalizedName,
          option.normalizedLabel,
        ]) ?? (option.normalizedUf.includes(normalizedValue) ? 2 : null),
    }))
    .filter((entry) => entry.rank !== null)
    .sort((left, right) => (left.rank ?? 2) - (right.rank ?? 2))
    .map(({ option }) => option.label);
}

export function filterSearchOptions(value: string) {
  return filterOptions(searchOptionsMetadata, value);
}

export function filterStateOnlyOptions(value: string) {
  return filterOptions(stateOptionsMetadata, value);
}

export const filterStateOptions = filterSearchOptions;

export type SearchOptionLevel =
  | "country"
  | "region"
  | "state"
  | "biome"
  | "semiarid"
  | "asd"
  | "municipality";

// Os rótulos de município sempre trazem a UF ("Sousa - PB"), então não se
// confundem com o nome de um estado ou de um recorte.
export function getSearchOptionLevel(label: string): SearchOptionLevel {
  const normalizedLabel = normalize(label);
  if (normalizedLabel === brazilNormalized) return "country";
  const spatialScope = findSpatialScopeSearchOption(label);
  if (spatialScope) return spatialScope.spatialArea as SearchOptionLevel;
  if (statesNormalized.has(normalizedLabel)) return "state";
  return "municipality";
}

export function validateSearch(value: string) {
  const normalizedValue = normalize(value.trim());

  if (
    !(
      normalizedValue === brazilNormalized ||
      statesNormalized.has(normalizedValue) ||
      ufsNormalized.has(normalizedValue) ||
      spatialScopeOptionByLabel.has(normalizedValue) ||
      cityLabelsNormalized.has(normalizedValue) ||
      cityNamesNormalized.has(normalizedValue)
    )
  ) {
    throw new Error("Estado ou município não identificado.");
  }
}

export function validateStateOnlySearch(value: string) {
  const normalizedValue = normalize(value.trim());

  if (
    !(
      normalizedValue === brazilNormalized ||
      statesNormalized.has(normalizedValue) ||
      ufsNormalized.has(normalizedValue)
    )
  ) {
    throw new Error("Estado não identificado.");
  }
}
