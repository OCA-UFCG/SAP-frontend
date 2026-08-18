import { describe, expect, it } from "vitest";
import {
  DEFAULT_SPATIAL_SELECTION,
  getSpatialScopeLocationKey,
  getSpatialScopeLocationName,
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
    ["state", "Paraíba"],
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

  it.each([
    [{ spatialArea: "national", spatialValue: "brasil" }, "br", "Brasil"],
    [
      { spatialArea: "region", spatialValue: "Centro-Oeste" },
      "2_regiao-centro-oeste",
      "Centro-Oeste",
    ],
    [
      { spatialArea: "state", spatialValue: "Paraíba" },
      "6_estado-paraiba",
      "Paraíba",
    ],
    [
      { spatialArea: "biome", spatialValue: "Mata Atlântica" },
      "3_bioma-mata-atlantica",
      "Mata Atlântica",
    ],
    [
      { spatialArea: "asd", spatialValue: "ASD" },
      "4_asd-asd-entorno",
      "ASD + Entorno",
    ],
    [
      { spatialArea: "semiarid", spatialValue: "semiárido" },
      "5_semiarido-semiarido-total",
      "Semiárido Total",
    ],
  ] as const)(
    "maps $spatialArea/$spatialValue to its canonical CSV location",
    (selection, expectedKey, expectedName) => {
      expect(getSpatialScopeLocationKey(selection)).toBe(expectedKey);
      expect(getSpatialScopeLocationName(selection)).toBe(expectedName);
    },
  );
});
