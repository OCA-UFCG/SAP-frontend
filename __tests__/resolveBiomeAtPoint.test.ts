import { describe, expect, it } from "vitest";
import type { Map as MaplibreMap } from "maplibre-gl";
import { resolveBiomeAtPoint } from "@/components/Map/resolveBiomeAtPoint";
import { SPATIAL_BOUNDARY_FILL_LAYER_ID } from "@/components/Map/mapDefinitions";

/** Mapa mínimo: responde quais features de contorno estão sob o ponto. */
class FakeBoundaryMap {
  constructor(
    private readonly renderedNames: string[],
    private readonly hasFillLayer = true,
  ) {}

  getLayer = (layerId: string) =>
    this.hasFillLayer && layerId === SPATIAL_BOUNDARY_FILL_LAYER_ID
      ? ({ id: layerId } as unknown)
      : undefined;

  queryRenderedFeatures = () =>
    this.renderedNames.map((name) => ({ properties: { name } }));
}

const asMap = (fake: FakeBoundaryMap) => fake as unknown as MaplibreMap;
const point = [10, 20] as [number, number];

describe("resolveBiomeAtPoint", () => {
  it("uses the biome drawn on top of the point", () => {
    const map = asMap(new FakeBoundaryMap(["Cerrado", "Caatinga"]));

    expect(resolveBiomeAtPoint(map, point, "ba")).toBe("Cerrado");
  });

  it("ignores rendered features that are not selectable biomes", () => {
    const map = asMap(new FakeBoundaryMap(["Entorno", "Pantanal"]));

    expect(resolveBiomeAtPoint(map, point, "ms")).toBe("Pantanal");
  });

  it("falls back to the clicked state when no boundary is rendered", () => {
    const map = asMap(new FakeBoundaryMap([]));

    expect(resolveBiomeAtPoint(map, point, "am")).toBe("Amazônia");
  });

  it("falls back to the clicked state when the fill layer is absent", () => {
    const map = asMap(new FakeBoundaryMap(["Caatinga"], false));

    expect(resolveBiomeAtPoint(map, point, "ba")).toBe("Caatinga");
  });

  it("is deterministic for a state that belongs to two biomes", () => {
    // Regressão: o balão dizia "Pampa" e o clique selecionava "Mata Atlântica"
    // porque hover e clique resolviam o bioma do RS por regras diferentes.
    // Agora a escolha é uma só, e o teste fixa qual.
    const map = asMap(new FakeBoundaryMap([]));

    expect(resolveBiomeAtPoint(map, point, "rs")).toBe("Pampa");
  });

  it("returns undefined without a map and without a state", () => {
    expect(resolveBiomeAtPoint(null, point, undefined)).toBeUndefined();
  });
});
