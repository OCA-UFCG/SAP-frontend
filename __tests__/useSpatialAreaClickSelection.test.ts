import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Map as MaplibreMap } from "maplibre-gl";
import { useSpatialAreaClickSelection } from "@/components/Map/useSpatialAreaClickSelection";
import { resolveBiomeAtPoint } from "@/components/Map/resolveBiomeAtPoint";
import { SPATIAL_BOUNDARY_FILL_LAYER_ID } from "@/components/Map/mapDefinitions";
import type { SpatialArea } from "@/utils/spatialScope";

/** Mapa mínimo: responde quais contornos estão desenhados sob o clique. */
class FakeBoundaryMap {
  constructor(private readonly renderedNames: string[] = []) {}

  getLayer = (layerId: string) =>
    layerId === SPATIAL_BOUNDARY_FILL_LAYER_ID
      ? ({ id: layerId } as unknown)
      : undefined;

  queryRenderedFeatures = () =>
    this.renderedNames.map((name) => ({ properties: { name } }));
}

const point = [10, 20] as [number, number];

const renderResolver = (
  spatialArea: SpatialArea,
  spatialValue: string,
  renderedNames: string[] = [],
) => {
  const map = new FakeBoundaryMap(renderedNames) as unknown as MaplibreMap;
  const { result } = renderHook(() =>
    useSpatialAreaClickSelection({
      mapRef: { current: map },
      spatialAreaRef: { current: spatialArea },
      spatialValueRef: { current: spatialValue },
    }),
  );
  return { resolveSpatialClick: result.current.resolveSpatialClick, map };
};

describe("useSpatialAreaClickSelection", () => {
  describe("biome scope", () => {
    it("switches to the biome under the cursor", () => {
      const { resolveSpatialClick } = renderResolver("biome", "Caatinga", [
        "Cerrado",
      ]);

      expect(resolveSpatialClick(point, "ba")).toEqual({
        spatialArea: "biome",
        spatialValue: "Cerrado",
      });
    });

    it("swallows the click inside the biome already selected", () => {
      const { resolveSpatialClick } = renderResolver("biome", "Caatinga", [
        "Caatinga",
      ]);

      expect(resolveSpatialClick(point, "ba")).toBe("block");
    });

    it("swallows the click when there is no biome under the cursor", () => {
      const { resolveSpatialClick } = renderResolver("biome", "Caatinga");

      expect(resolveSpatialClick(point, undefined)).toBe("block");
    });

    it("selects exactly the biome the hover popup would name", () => {
      // O clique e o balão precisam concordar: os dois passam pela mesma função.
      const { resolveSpatialClick, map } = renderResolver("biome", "Caatinga", [
        "Pantanal",
      ]);

      expect(resolveSpatialClick(point, "ms")).toEqual({
        spatialArea: "biome",
        spatialValue: resolveBiomeAtPoint(map, point, "ms"),
      });
    });
  });

  describe("region scope", () => {
    it("switches to the region of the clicked state", () => {
      const { resolveSpatialClick } = renderResolver("region", "Nordeste");

      expect(resolveSpatialClick(point, "sp")).toEqual({
        spatialArea: "region",
        spatialValue: "Sudeste",
      });
    });

    it("lets the state selection happen inside the current region", () => {
      const { resolveSpatialClick } = renderResolver("region", "Nordeste");

      expect(resolveSpatialClick(point, "ba")).toBeNull();
    });

    it("does not intercept a click outside any state", () => {
      const { resolveSpatialClick } = renderResolver("region", "Nordeste");

      expect(resolveSpatialClick(point, undefined)).toBeNull();
    });
  });

  it.each(["national", "state", "semiarid", "asd"] as const)(
    "never intercepts clicks in %s scope",
    (spatialArea) => {
      const { resolveSpatialClick } = renderResolver(spatialArea, "brasil", [
        "Caatinga",
      ]);

      expect(resolveSpatialClick(point, "ba")).toBeNull();
    },
  );
});
