import { normalize } from "@/utils/functions";
import { states, ufs, statesObj } from "@/utils/constants";

export const BRAZIL_OPTION = "Brasil";
export const statesNormalized = new Set(Array.from(states).map(normalize));
export const ufsNormalized = new Set(Array.from(ufs).map(normalize));
export const brazilNormalized = normalize(BRAZIL_OPTION);
export const stateOptions = [BRAZIL_OPTION, ...Array.from(states)];

export const stateOptionsMetadata = [
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

export function filterStateOptions(value: string) {
  const normalizedValue = normalize(value.trim());

  return stateOptionsMetadata
    .filter((option) => {
      if (!normalizedValue) return true;

      return (
        option.normalizedLabel.includes(normalizedValue) ||
        option.normalizedUf.includes(normalizedValue)
      );
    })
    .map((option) => option.label);
}

export function validateSearch(value: string) {
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
