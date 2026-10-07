import { describe, expect, it } from "vitest";
import {
  getAllSpatialBoundaryFeaturesForArea,
  getSpatialBoundaryFeatures,
  loadSpatialBoundaryIndex,
} from "@/app/api/ee/spatialBoundaries";

describe("spatial boundary repository", () => {
  it("loads the configured WGS84 GeoJSON collections", () => {
    const index = loadSpatialBoundaryIndex();

    expect(index.get("region")?.size).toBe(5);
    expect(index.get("biome")?.size).toBe(6);
    expect(index.get("semiarid")?.size).toBe(1);
    expect(index.get("asd")?.size).toBe(2);
  });

  it("combines ASD and its surroundings for the advertised selection", () => {
    const features = getSpatialBoundaryFeatures({
      spatialArea: "asd",
      spatialValue: "ASD",
    });

    expect(features.map((feature) => feature.properties.name)).toEqual([
      "ASD",
      "Entorno",
    ]);
  });

  it("returns every biome of the area, not just the selected one", () => {
    // O mapa em modo bioma precisa dos vizinhos desenhados para o clique e o
    // hover trocarem de bioma.
    const names = getAllSpatialBoundaryFeaturesForArea("biome").map(
      (feature) => feature.properties.name,
    );

    expect(names.sort()).toEqual([
      "Amazônia",
      "Caatinga",
      "Cerrado",
      "Mata Atlântica",
      "Pampa",
      "Pantanal",
    ]);
  });

  it("fails explicitly when a boundary file cannot be loaded", () => {
    expect(() =>
      loadSpatialBoundaryIndex({
        readFile: () => {
          throw new Error("missing");
        },
      }),
    ).toThrow("Unable to load spatial boundary");
  });

  it("fails explicitly for malformed boundary data", () => {
    expect(() =>
      loadSpatialBoundaryIndex({
        readFile: () => JSON.stringify({ type: "FeatureCollection" }),
      }),
    ).toThrow("must contain a GeoJSON FeatureCollection");
  });

  it("fails explicitly when a configured feature is absent", () => {
    expect(() =>
      loadSpatialBoundaryIndex({
        readFile: () =>
          JSON.stringify({ type: "FeatureCollection", features: [] }),
      }),
    ).toThrow("is missing the configured boundary");
  });
});
