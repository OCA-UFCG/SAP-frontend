import { describe, expect, it } from "vitest";
import { getAllowedStateUfs } from "@/utils/interestAreaStates";

describe("getAllowedStateUfs", () => {
  it("returns null for national", () => {
    expect(
      getAllowedStateUfs({
        spatialArea: "national",
        spatialValue: "brasil",
      }),
    ).toBeNull();
  });

  it("returns all states of a region", () => {
    const allowed = getAllowedStateUfs({
      spatialArea: "region",
      spatialValue: "Nordeste",
    });
    expect(allowed?.has("ba")).toBe(true);
    expect(allowed?.has("sp")).toBe(false);
    expect(allowed?.size).toBe(9);
  });

  it("filters by biome", () => {
    const allowed = getAllowedStateUfs({
      spatialArea: "biome",
      spatialValue: "Pampa",
    });
    expect(allowed?.has("rs")).toBe(true);
    expect(allowed?.has("am")).toBe(false);
  });

  it("filters by semiarid and asd", () => {
    expect(
      getAllowedStateUfs({
        spatialArea: "semiarid",
        spatialValue: "semiárido",
      })?.has("ba"),
    ).toBe(true);
    expect(
      getAllowedStateUfs({
        spatialArea: "asd",
        spatialValue: "ASD",
      })?.has("rj"),
    ).toBe(true);
  });
});
