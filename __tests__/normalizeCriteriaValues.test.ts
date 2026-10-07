import { describe, expect, test } from "vitest";
import {
  normalizeCriteriaInputValue,
  normalizeCriteriaValues,
  preserveCriteriaInputValues,
} from "@/utils/normalizeCriteriaValues";

describe("normalizeCriteriaInputValue", () => {
  test.each([
    ["", 1],
    ["0", 1],
    ["1", 1],
    ["1.6", 2],
    ["10", 10],
    ["11", 10],
  ])("converts %j to an integer between one and ten", (value, expected) => {
    expect(normalizeCriteriaInputValue(value)).toBe(expected);
  });
});

describe("normalizeCriteriaValues", () => {
  test("maintains the proportion of literal input values", () => {
    expect(normalizeCriteriaValues([2, 3, 5])).toEqual([0.2, 0.3, 0.5]);
  });

  test.each([6, 8])(
    "creates valid equal weights when selecting %i criteria",
    (criteriaCount) => {
      const weights = normalizeCriteriaValues(Array(criteriaCount).fill(1));

      expect(weights).toHaveLength(criteriaCount);
      expect(
        weights.reduce((sum, value) => sum + value, 0),
      ).toBeLessThanOrEqual(1);
      expect(weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
    },
  );

  test("does not exceed one after rounding proportional values", () => {
    const weights = normalizeCriteriaValues([0.1, 0.12, 0.01]);

    expect(weights.reduce((sum, value) => sum + value, 0)).toBeLessThanOrEqual(
      1,
    );
    expect(weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12);
  });
});

describe("preserveCriteriaInputValues", () => {
  test("keeps typed weights for retained criteria and defaults only new ones", () => {
    expect(
      preserveCriteriaInputValues(
        ["criterion-b", "criterion-c", "criterion-d"],
        ["criterion-a", "criterion-b", "criterion-c"],
        ["2", "6", "4"],
      ),
    ).toEqual(["6", "4", "1"]);
  });
});
