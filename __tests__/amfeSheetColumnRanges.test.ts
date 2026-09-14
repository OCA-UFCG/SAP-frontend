import { describe, expect, it } from "vitest";

import {
  buildEqualIntervalThresholds,
  suggestColumnClassification,
} from "@/utils/amfeSheetColumnRanges";

describe("buildEqualIntervalThresholds", () => {
  it("splits the range into equal parts", () => {
    expect(buildEqualIntervalThresholds(0, 100, 4)).toEqual([25, 50, 75]);
  });

  it("rounds the limits to the precision the range deserves", () => {
    expect(buildEqualIntervalThresholds(0, 1, 3)).toEqual([0.33, 0.67]);
  });

  // Arredondar dois limites para o mesmo número criaria uma faixa vazia, que
  // pintaria uma cor que nenhum município tem.
  it("keeps the exact limits when rounding would collapse two of them", () => {
    const thresholds = buildEqualIntervalThresholds(0, 0.00001, 3);

    expect(new Set(thresholds).size).toBe(2);
  });
});

describe("suggestColumnClassification", () => {
  it("describes every range, with the unit in the label", () => {
    const suggestion = suggestColumnClassification([0, 50, 100], 3, "%");

    expect(suggestion.min).toBe(0);
    expect(suggestion.max).toBe(100);
    expect(suggestion.thresholds).toEqual([33, 67]);
    expect(suggestion.ranges.map((range) => range.label)).toEqual([
      "Até 33 %",
      "33 % a 67 %",
      "Acima de 67 %",
    ]);
    expect(suggestion.ranges.map((range) => range.id)).toEqual([
      "faixa-1",
      "faixa-2",
      "faixa-3",
    ]);
  });

  it("gives every range a distinct color from end to end of the palette", () => {
    const colors = suggestColumnClassification([0, 10], 4, "").ranges.map(
      (range) => range.color,
    );

    expect(new Set(colors).size).toBe(4);
  });

  it("refuses a column whose municipalities all share the same value", () => {
    expect(() => suggestColumnClassification([7, 7, 7], 3, "")).toThrowError(
      /mesmo valor \(7\)/u,
    );
  });

  it("refuses a range count the palette cannot describe", () => {
    expect(() => suggestColumnClassification([0, 1], 1, "")).toThrowError(
      /entre 2 e 8/u,
    );
    expect(() => suggestColumnClassification([0, 1], 9, "")).toThrowError(
      /entre 2 e 8/u,
    );
  });

  it("refuses an empty column", () => {
    expect(() => suggestColumnClassification([], 3, "")).toThrowError(
      /nenhum valor numérico/u,
    );
  });
});
