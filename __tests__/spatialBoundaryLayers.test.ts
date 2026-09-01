import type { FeatureCollection, Geometry } from "geojson";
import type maplibregl from "maplibre-gl";
import { describe, expect, it, vi } from "vitest";
import { CLASSIFICATION_LAYER_ID } from "@/components/Map/classificationLayers";
import {
  GEE_LAYER_ID,
  REF_OVERLAY_LAYER_PREFIX,
  SPATIAL_BOUNDARY_FILL_LAYER_ID,
  SPATIAL_BOUNDARY_LAYER_ID,
  SPATIAL_BOUNDARY_SOURCE_ID,
  STATES_BORDER_LAYER_ID,
  STATES_FILL_LAYER_ID,
  ensureMapLayers,
  ensureReferenceOverlayLayers,
  ensureSpatialBoundaryLayer,
} from "@/components/Map/mapDefinitions";
import { MUNICIPALITY_HOVER_LAYER_ID } from "@/components/Map/municipalityLayers";

const boundaryGeoJson: FeatureCollection<Geometry, { name: string }> = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { name: "Caatinga" },
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-40, -10],
            [-39, -10],
            [-39, -9],
            [-40, -10],
          ],
        ],
      },
    },
  ],
};

function createOrderedMapMock() {
  const layers: string[] = [];
  const layerSpecs = new Map<string, { id: string }>();
  const sources = new Map<
    string,
    { setData: ReturnType<typeof vi.fn>; spec: unknown }
  >();

  const map = {
    addLayer: vi.fn((layer: { id: string }, beforeId?: string) => {
      const beforeIndex = beforeId ? layers.indexOf(beforeId) : -1;
      if (beforeIndex >= 0) {
        layers.splice(beforeIndex, 0, layer.id);
      } else {
        layers.push(layer.id);
      }
      layerSpecs.set(layer.id, layer);
      return map;
    }),
    addSource: vi.fn((sourceId: string, spec: unknown) => {
      sources.set(sourceId, { setData: vi.fn(), spec });
      return map;
    }),
    getLayer: vi.fn((layerId: string) => layerSpecs.get(layerId)),
    getSource: vi.fn((sourceId: string) => sources.get(sourceId)),
    getStyle: vi.fn(() => ({
      sources: Object.fromEntries(
        Array.from(sources, ([sourceId, source]) => [sourceId, source.spec]),
      ),
    })),
    removeLayer: vi.fn((layerId: string) => {
      const index = layers.indexOf(layerId);
      if (index >= 0) layers.splice(index, 1);
      layerSpecs.delete(layerId);
      return map;
    }),
    removeSource: vi.fn((sourceId: string) => {
      sources.delete(sourceId);
      return map;
    }),
    setFilter: vi.fn(() => map),
    setLayoutProperty: vi.fn(() => map),
  };

  return {
    layers,
    map: map as unknown as maplibregl.Map,
    rawMap: map,
    sources,
  };
}

describe("spatial boundary MapLibre layers", () => {
  it("renders a spatial boundary immediately below the state fills", () => {
    const { layers, map } = createOrderedMapMock();

    ensureMapLayers(map, "platform", true, false, null);
    ensureSpatialBoundaryLayer(map, boundaryGeoJson, true, new Set(["ba"]));

    expect(layers.indexOf(SPATIAL_BOUNDARY_LAYER_ID)).toBeLessThan(
      layers.indexOf(STATES_FILL_LAYER_ID),
    );
    expect(layers.indexOf(SPATIAL_BOUNDARY_FILL_LAYER_ID)).toBeLessThan(
      layers.indexOf(STATES_FILL_LAYER_ID),
    );
  });

  it("documents that a later GEE raster is placed above the boundary", () => {
    const { layers, map } = createOrderedMapMock();

    ensureMapLayers(map, "platform", true, false, null);
    ensureSpatialBoundaryLayer(map, boundaryGeoJson, true, new Set(["ba"]));

    // This matches the UI sequence: boundary HTTP response first, GEE URL later.
    ensureMapLayers(
      map,
      "platform",
      true,
      false,
      "https://tiles.example/{z}/{x}/{y}",
      1,
    );
    ensureSpatialBoundaryLayer(map, boundaryGeoJson, true, new Set(["ba"]));

    // Verify that GEE raster is placed BELOW the spatial boundary,
    // so it doesn't obscure the dark hover preview overlay.
    expect(layers.indexOf(GEE_LAYER_ID)).toBeLessThan(
      layers.indexOf(SPATIAL_BOUNDARY_LAYER_ID),
    );
    expect(layers.indexOf(GEE_LAYER_ID)).toBeLessThan(
      layers.indexOf(STATES_FILL_LAYER_ID),
    );
  });

  it("keeps the territory overlays above every analysis layer", () => {
    const { layers, map } = createOrderedMapMock();
    const quilombolasLayerId = `${REF_OVERLAY_LAYER_PREFIX}quilombolas`;

    ensureMapLayers(map, "platform", true, false, null);
    ensureReferenceOverlayLayers(
      map,
      new Map([["quilombolas", "https://tiles.example/q/{z}/{x}/{y}"]]),
    );

    // Sequência real da UI: o usuário liga o território e só depois aplica um
    // índice ou troca de período, o que readiciona o raster do GEE.
    ensureMapLayers(
      map,
      "platform",
      true,
      false,
      "https://tiles.example/2020/{z}/{x}/{y}",
      1,
    );
    ensureMapLayers(
      map,
      "platform",
      true,
      false,
      "https://tiles.example/2021/{z}/{x}/{y}",
      1,
    );

    expect(layers).toContain(CLASSIFICATION_LAYER_ID);
    expect(layers.indexOf(GEE_LAYER_ID)).toBeLessThan(
      layers.indexOf(quilombolasLayerId),
    );
    // A coropleta da AMFE é pintada com 85% de opacidade: abaixo dela o
    // território não apareceria no mapa da análise multicritério.
    expect(layers.indexOf(CLASSIFICATION_LAYER_ID)).toBeLessThan(
      layers.indexOf(quilombolasLayerId),
    );
    expect(layers.indexOf(quilombolasLayerId)).toBeLessThan(
      layers.indexOf(MUNICIPALITY_HOVER_LAYER_ID),
    );
    expect(layers.indexOf(quilombolasLayerId)).toBeLessThan(
      layers.indexOf(STATES_BORDER_LAYER_ID),
    );
  });

  it("hides state borders while boundary data is present", () => {
    const { map, rawMap } = createOrderedMapMock();

    ensureMapLayers(map, "platform", true, false, null);
    ensureSpatialBoundaryLayer(map, boundaryGeoJson, true, new Set(["ba"]));

    expect(rawMap.setLayoutProperty).toHaveBeenCalledWith(
      STATES_BORDER_LAYER_ID,
      "visibility",
      "none",
    );
    expect(rawMap.setFilter).toHaveBeenCalledWith(STATES_BORDER_LAYER_ID, null);
  });

  it("filters regional borders and restores national borders", () => {
    const { map, rawMap } = createOrderedMapMock();

    ensureMapLayers(map, "platform", true, false, null);
    ensureSpatialBoundaryLayer(map, null, true, new Set(["ba", "pe"]));

    expect(rawMap.setFilter).toHaveBeenLastCalledWith(STATES_BORDER_LAYER_ID, [
      "in",
      ["get", "SIGLA_UF"],
      ["literal", ["BA", "PE"]],
    ]);

    ensureSpatialBoundaryLayer(map, null, true, null);

    expect(rawMap.setLayoutProperty).toHaveBeenLastCalledWith(
      STATES_BORDER_LAYER_ID,
      "visibility",
      "visible",
    );
    expect(rawMap.setFilter).toHaveBeenLastCalledWith(
      STATES_BORDER_LAYER_ID,
      null,
    );
  });

  it("updates and removes the boundary source without leaving stale data", () => {
    const { map, rawMap, sources } = createOrderedMapMock();

    ensureMapLayers(map, "platform", true, false, null);
    ensureSpatialBoundaryLayer(map, boundaryGeoJson, true, new Set(["ba"]));

    const boundarySource = sources.get(SPATIAL_BOUNDARY_SOURCE_ID);
    expect(boundarySource).toBeDefined();

    const updatedBoundary = {
      ...boundaryGeoJson,
      features: boundaryGeoJson.features.map((feature) => ({
        ...feature,
        properties: { name: "Cerrado" },
      })),
    };
    ensureSpatialBoundaryLayer(map, updatedBoundary, true, new Set(["go"]));

    expect(boundarySource?.setData).toHaveBeenCalledWith(updatedBoundary);

    ensureSpatialBoundaryLayer(map, null, true, null);

    expect(rawMap.removeLayer).toHaveBeenCalledWith(SPATIAL_BOUNDARY_LAYER_ID);
    expect(rawMap.removeSource).toHaveBeenCalledWith(
      SPATIAL_BOUNDARY_SOURCE_ID,
    );
  });
});
