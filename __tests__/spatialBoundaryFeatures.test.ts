import { describe, expect, it } from "vitest";
import type { FeatureCollection, Geometry } from "geojson";
import { selectActiveBoundaryFeatures } from "@/utils/spatialBoundaryFeatures";

const square = (west: number): Geometry => ({
  type: "Polygon",
  coordinates: [
    [
      [west, -10],
      [west + 5, -10],
      [west + 5, -5],
      [west, -5],
      [west, -10],
    ],
  ],
});

const collection = (
  ...names: string[]
): FeatureCollection<Geometry, { name: string }> => ({
  type: "FeatureCollection",
  features: names.map((name, index) => ({
    type: "Feature",
    properties: { name },
    geometry: square(-50 + index * 10),
  })),
});

describe("selectActiveBoundaryFeatures", () => {
  it("keeps only the selected boundary out of the whole area", () => {
    const active = selectActiveBoundaryFeatures(
      collection("Amazônia", "Caatinga", "Cerrado"),
      "Caatinga",
    );

    expect(active?.features.map((feature) => feature.properties.name)).toEqual([
      "Caatinga",
    ]);
  });

  it("keeps ASD and its surroundings together, as one recorte", () => {
    const active = selectActiveBoundaryFeatures(
      collection("ASD", "Entorno"),
      "ASD",
    );

    expect(active?.features.map((feature) => feature.properties.name)).toEqual([
      "ASD",
      "Entorno",
    ]);
  });

  it("returns null when nothing matches, so the caller can fall back", () => {
    expect(
      selectActiveBoundaryFeatures(collection("Amazônia"), "Pampa"),
    ).toBeNull();
    expect(selectActiveBoundaryFeatures(null, "Caatinga")).toBeNull();
  });
});
