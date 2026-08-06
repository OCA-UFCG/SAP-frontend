import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPATIAL_SELECTION,
  resolveSpatialSelection,
} from "@/utils/spatialScope";

describe("spatial scope selection", () => {
  it("normalizes omitted parameters to the canonical national selection", () => {
    expect(resolveSpatialSelection()).toEqual({
      ok: true,
      selection: DEFAULT_SPATIAL_SELECTION,
    });
  });

  it.each([
    ["national", "brasil"],
    ["region", "Nordeste"],
    ["biome", "Caatinga"],
    ["semiarid", "semiárido"],
    ["asd", "ASD"],
  ])("accepts %s/%s", (spatialArea, spatialValue) => {
    expect(resolveSpatialSelection(spatialArea, spatialValue)).toEqual({
      ok: true,
      selection: { spatialArea, spatialValue },
    });
  });

  it("rejects partial, unknown, and mismatched selections", () => {
    expect(resolveSpatialSelection("region")).toMatchObject({ ok: false });
    expect(resolveSpatialSelection(undefined, "Nordeste")).toMatchObject({
      ok: false,
    });
    expect(resolveSpatialSelection("state", "PB")).toMatchObject({ ok: false });
    expect(resolveSpatialSelection("biome", "Nordeste")).toMatchObject({
      ok: false,
    });
  });
});
