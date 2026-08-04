import { describe, expect, it } from "vitest";
import { getAllowedStateUfs } from "@/utils/interestAreaStates";

describe("getAllowedStateUfs", () => {
  it("returns null for national", () => {
    expect(
      getAllowedStateUfs({
        interestedArea: "national",
        interestedAreaValue: "brasil",
      }),
    ).toBeNull();
  });

  it("returns all states of a region", () => {
    const allowed = getAllowedStateUfs({
      interestedArea: "region",
      interestedAreaValue: "Nordeste",
    });
    expect(allowed?.has("ba")).toBe(true);
    expect(allowed?.has("sp")).toBe(false);
    expect(allowed?.size).toBe(9);
  });

  it("filters by biome", () => {
    const allowed = getAllowedStateUfs({
      interestedArea: "biome",
      interestedAreaValue: "Pampa",
    });
    expect(allowed?.has("rs")).toBe(true);
    expect(allowed?.has("am")).toBe(false);
  });

  it("filters by semiarid and asd", () => {
    expect(
      getAllowedStateUfs({
        interestedArea: "semiarid",
        interestedAreaValue: "semiárido",
      })?.has("ba"),
    ).toBe(true);
    expect(
      getAllowedStateUfs({
        interestedArea: "asd",
        interestedAreaValue: "ASD",
      })?.has("rj"),
    ).toBe(true);
  });
});
