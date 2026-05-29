import { normalize } from "@/utils/functions";
import { states, ufs, statesObj } from "@/utils/constants";
import citiesIndex from "@/data/citiesIndex.json";

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

export const searchOptionsMetadata = [
  ...stateOptionsMetadata,
  ...cityOptionsMetadata,
];

function filterOptions(options: SearchOptionMetadata[], value: string) {
  const normalizedValue = normalize(value.trim());

  return options
    .filter((option) => {
      if (!normalizedValue) return true;

      return (
        option.normalizedLabel.includes(normalizedValue) ||
        option.normalizedName?.includes(normalizedValue) ||
        option.normalizedUf.includes(normalizedValue)
      );
    })
    .map((option) => option.label);
}

export function filterSearchOptions(value: string) {
  return filterOptions(searchOptionsMetadata, value);
}

export function filterStateOnlyOptions(value: string) {
  return filterOptions(stateOptionsMetadata, value);
}

export const filterStateOptions = filterSearchOptions;

export function validateSearch(value: string) {
  const normalizedValue = normalize(value.trim());

  if (
    !(
      normalizedValue === brazilNormalized ||
      statesNormalized.has(normalizedValue) ||
      ufsNormalized.has(normalizedValue) ||
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
