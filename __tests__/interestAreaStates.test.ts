import { describe, expect, it } from "vitest";
import {
  getAllowedStateUfs,
  getStateBiomes,
  getStateRegion,
} from "@/utils/interestAreaStates";

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

  it("filters by state", () => {
    const allowed = getAllowedStateUfs({
      spatialArea: "state",
      spatialValue: "Paraíba",
    });
    expect(allowed?.has("pb")).toBe(true);
    expect(allowed?.has("ba")).toBe(false);
    expect(allowed?.size).toBe(1);
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

describe("getStateRegion & getStateBiomes", () => {
  it("returns region for given UF", () => {
    expect(getStateRegion("ba")).toBe("Nordeste");
    expect(getStateRegion("sp")).toBe("Sudeste");
    expect(getStateRegion("am")).toBe("Norte");
    expect(getStateRegion("unknown")).toBeNull();
  });

  it("returns biomes for given UF", () => {
    expect(getStateBiomes("am")).toEqual(["Amazônia"]);
    expect(getStateBiomes("rs")).toEqual(["Pampa", "Mata Atlântica"]);
    expect(getStateBiomes("unknown")).toEqual([]);
  });
});

