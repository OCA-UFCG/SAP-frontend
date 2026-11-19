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
    expect(index.get("asd")?.size).toBe(1);
  });

  it("draws ASD and its surroundings as a single boundary", () => {
    // Duas features faziam o mapa contornar cada uma, e a divisa entre a ASD e
    // o Entorno aparecia como linha no meio do recorte.
    const features = getSpatialBoundaryFeatures({
      spatialArea: "asd",
      spatialValue: "ASD",
    });

    expect(features.map((feature) => feature.properties.name)).toEqual([
      "ASD",
    ]);
  });

  it("keeps the ASD boundary free of slivers between ASD and Entorno", () => {
    // As camadas originais não se encostavam perfeitamente: a união deixava
    // frestas de ~200 m, que o mapa desenhava como risquinhos dentro do recorte.
    const [asd] = getSpatialBoundaryFeatures({
      spatialArea: "asd",
      spatialValue: "ASD",
    });

    expect(asd.geometry.type).toBe("MultiPolygon");
    const polygons =
      asd.geometry.type === "MultiPolygon" ? asd.geometry.coordinates : [];
    expect(polygons.every((rings) => rings.length === 1)).toBe(true);
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
