const NORMALIZATION_PRECISION = 10000;
export const MIN_CRITERIA_INPUT_VALUE = 1;
export const MAX_CRITERIA_INPUT_VALUE = 10;

const roundWeight = (value: number) =>
  Math.round(value * NORMALIZATION_PRECISION) / NORMALIZATION_PRECISION;

export const normalizeCriteriaInputValue = (value: string): number => {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) return MIN_CRITERIA_INPUT_VALUE;

  return Math.min(
    MAX_CRITERIA_INPUT_VALUE,
    Math.max(MIN_CRITERIA_INPUT_VALUE, Math.round(numericValue)),
  );
};

export const normalizeCriteriaValues = (values: number[]): number[] => {
  if (values.length === 0) return [];

  const sanitizedValues = values.map((value) =>
    Number.isFinite(value) && value > 0 ? value : 0,
  );
  const total = sanitizedValues.reduce((sum, value) => sum + value, 0);
  const proportionalValues =
    total > 0
      ? sanitizedValues.map((value) => value / total)
      : sanitizedValues.map(() => 1 / sanitizedValues.length);

  let accumulated = 0;
  const normalizedValues = proportionalValues.map((value, index) => {
    if (index === proportionalValues.length - 1) {
      return Math.max(0, 1 - accumulated);
    }

    const roundedValue = roundWeight(value);
    accumulated += roundedValue;
    return roundedValue;
  });

  const normalizedTotal = normalizedValues.reduce(
    (sum, value) => sum + value,
    0,
  );

  if (normalizedTotal > 1) {
    const indexToAdjust = normalizedValues.findLastIndex((value) => value > 0);

    if (indexToAdjust >= 0) {
      normalizedValues[indexToAdjust] -= normalizedTotal - 1;
    }
  }

  return normalizedValues;
};

export const preserveCriteriaInputValues = (
  selectedNames: string[],
  currentNames: string[],
  currentValues: string[],
): string[] => {
  const currentValuesByName = new Map(
    currentNames.map((name, index) => [
      name,
      currentValues[index] ?? String(MIN_CRITERIA_INPUT_VALUE),
    ]),
  );

  return selectedNames.map(
    (name) => currentValuesByName.get(name) ?? String(MIN_CRITERIA_INPUT_VALUE),
  );
};
