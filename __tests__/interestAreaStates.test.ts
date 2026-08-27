import { describe, expect, it } from "vitest";
import {
  getAllowedStateUfs,
  getRegionStateUfs,
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

describe("getRegionStateUfs", () => {
  it("lists every UF of a region, in lowercase", () => {
    expect(getRegionStateUfs("Sul").sort()).toEqual(["pr", "rs", "sc"]);
  });

  it("covers the 27 UFs across the five regions without repeating any", () => {
    const ufs = ["Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"].flatMap(
      (region) => getRegionStateUfs(region),
    );

    expect(new Set(ufs).size).toBe(27);
    expect(ufs).toHaveLength(27);
  });

  it("returns an empty list for a name that is not a region", () => {
    expect(getRegionStateUfs("Caatinga")).toEqual([]);
  });
});
