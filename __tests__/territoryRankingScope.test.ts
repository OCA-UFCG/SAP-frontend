import { describe, expect, it } from "vitest";

import { getTerritoryRankingScope } from "@/utils/territoryRankingScope";

describe("getTerritoryRankingScope", () => {
  it("lists the states of a region", () => {
    expect(getTerritoryRankingScope("2_regiao-nordeste")).toEqual({
      entity: "states",
      locationKeys: expect.arrayContaining([
        "al",
        "ba",
        "ce",
        "ma",
        "pb",
        "pe",
        "pi",
        "rn",
        "se",
      ]),
    });
    expect(
      getTerritoryRankingScope("2_regiao-nordeste")?.locationKeys,
    ).toHaveLength(9);
    expect(
      getTerritoryRankingScope("2_regiao-centro-oeste")?.locationKeys,
    ).toEqual(expect.arrayContaining(["df", "go", "ms", "mt"]));
  });

  it("lists the municipalities of a state", () => {
    const scope = getTerritoryRankingScope("pb");

    expect(scope?.entity).toBe("municipalities");
    expect(scope?.locationKeys).toHaveLength(223);
    expect(scope?.locationKeys).toContain("2507507");
  });

  it("lists the municipalities whose predominant biome is the selected one", () => {
    const scope = getTerritoryRankingScope("3_bioma-caatinga");

    expect(scope?.entity).toBe("municipalities");
    expect(scope?.locationKeys).toHaveLength(1095);
    // Campina Grande (PB) fica na Caatinga; João Pessoa, na Mata Atlântica.
    expect(scope?.locationKeys).toContain("2504009");
    expect(scope?.locationKeys).not.toContain("2507507");
  });

  it("lists Semiárido and ASD + Entorno", () => {
    expect(
      getTerritoryRankingScope("5_semiarido-semiarido-total")?.locationKeys,
    ).toHaveLength(1477);
    expect(
      getTerritoryRankingScope("4_asd-asd-entorno")?.locationKeys,
    ).toHaveLength(1649);
  });

  it("leaves the lagoon operational areas out of RS and Pampa", () => {
    for (const locationKey of ["rs", "3_bioma-pampa"]) {
      expect(getTerritoryRankingScope(locationKey)?.locationKeys).not.toContain(
        "4300001",
      );
      expect(getTerritoryRankingScope(locationKey)?.locationKeys).not.toContain(
        "4300002",
      );
    }
  });

  it("has no list for Brazil or a municipality", () => {
    expect(getTerritoryRankingScope("br")).toBeNull();
    expect(getTerritoryRankingScope("2507507")).toBeNull();
  });
});
