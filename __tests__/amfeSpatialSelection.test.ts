import { describe, expect, it } from "vitest";
import { toSpatialSelection } from "@/utils/amfeSpatialSelection";
import { interestAreaOptionsByLevel } from "@/utils/amfeConsts";
import { SPATIAL_VALUE_OPTIONS } from "@/utils/spatialScope";
import { getAllowedStateUfs } from "@/utils/interestAreaStates";
import type { interestArea } from "@/utils/amfeInterfaces";

describe("toSpatialSelection", () => {
  it("translates every UF the AMFE form can emit", () => {
    const stateNames = new Set(
      SPATIAL_VALUE_OPTIONS.state.map((option) => option.value),
    );

    for (const uf of interestAreaOptionsByLevel.state) {
      const selection = toSpatialSelection({ type: "state", value: uf });

      expect(selection, `UF ${uf} não traduzida`).not.toBeNull();
      expect(stateNames).toContain(selection?.spatialValue);
    }
  });

  it("fixes the region casing mismatch between the two projects", () => {
    expect(
      toSpatialSelection({ type: "region", value: "Centro-oeste" }),
    ).toEqual({ spatialArea: "region", spatialValue: "Centro-Oeste" });
  });

  it("translates every region the AMFE form can emit", () => {
    const regionNames = new Set(
      SPATIAL_VALUE_OPTIONS.region.map((option) => option.value),
    );

    for (const region of interestAreaOptionsByLevel.region) {
      const selection = toSpatialSelection({ type: "region", value: region });

      expect(selection, `região ${region} não traduzida`).not.toBeNull();
      expect(regionNames).toContain(selection?.spatialValue);
    }
  });

  it("maps the AMFE sentinel values for semiarid and ASD", () => {
    expect(toSpatialSelection({ type: "semiarid", value: "semiarid" })).toEqual({
      spatialArea: "semiarid",
      spatialValue: "semiárido",
    });
    expect(toSpatialSelection({ type: "asd", value: "asd" })).toEqual({
      spatialArea: "asd",
      spatialValue: "ASD",
    });
  });

  it("keeps biome names, which already agree in both projects", () => {
    for (const biome of interestAreaOptionsByLevel.biome) {
      expect(toSpatialSelection({ type: "biome", value: biome })).toEqual({
        spatialArea: "biome",
        spatialValue: biome,
      });
    }
  });

  it("covers every interest area the form offers", () => {
    const areas = Object.keys(interestAreaOptionsByLevel) as interestArea[];

    for (const area of areas) {
      const [firstValue] = interestAreaOptionsByLevel[area];
      expect(
        toSpatialSelection({ type: area, value: firstValue }),
        `área ${area} sem tradução`,
      ).not.toBeNull();
    }
  });

  it("returns null for an unknown value instead of guessing", () => {
    expect(toSpatialSelection({ type: "state", value: "ZZ" })).toBeNull();
    expect(toSpatialSelection({ type: "biome", value: "Tundra" })).toBeNull();
    expect(toSpatialSelection(null)).toBeNull();
  });

  it("produces selections the platform framing helpers accept", () => {
    // Prova de que a tradução serve para enquadrar o mapa, não só de que o
    // formato casa: getAllowedStateUfs devolve estados de verdade.
    const paraiba = toSpatialSelection({ type: "state", value: "PB" });
    expect(getAllowedStateUfs(paraiba)).toEqual(new Set(["pb"]));

    const northeast = toSpatialSelection({
      type: "region",
      value: "Nordeste",
    });
    expect(getAllowedStateUfs(northeast)?.size).toBe(9);
  });
});
