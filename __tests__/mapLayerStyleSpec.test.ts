import { validateStyleMin } from "@maplibre/maplibre-gl-style-spec";
import type { FeatureCollection, Geometry } from "geojson";
import type maplibregl from "maplibre-gl";
import { describe, expect, it, vi } from "vitest";
import {
  ensureMapLayers,
  ensureSpatialBoundaryLayer,
} from "@/components/Map/mapDefinitions";

/**
 * Uma expressão de pintura inválida não quebra o build nem os testes que só
 * comparam o objeto: o MapLibre recusa a camada em tempo de execução e o mapa
 * aparece sem ela. Este teste roda o validador oficial do style spec sobre as
 * camadas que o projeto adiciona, que é onde o erro realmente aparece.
 *
 * Regressão: `line-width` do contorno municipal foi escrito com dois
 * `interpolate` de zoom dentro de um `case`, e o MapLibre aceita só um.
 */
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

type CapturedLayer = { id: string };

function createLayerCollectingMap() {
  const addedLayers: CapturedLayer[] = [];
  const knownLayers = new Set<string>();
  const knownSources = new Map<string, unknown>();

  const map = {
    addLayer: vi.fn((layer: CapturedLayer) => {
      addedLayers.push(layer);
      knownLayers.add(layer.id);
      return map;
    }),
    addSource: vi.fn((sourceId: string, spec: unknown) => {
      knownSources.set(sourceId, spec);
      return map;
    }),
    getLayer: vi.fn((layerId: string) =>
      knownLayers.has(layerId) ? { id: layerId } : undefined,
    ),
    getSource: vi.fn((sourceId: string) => knownSources.get(sourceId)),
    getStyle: vi.fn(() => ({ sources: Object.fromEntries(knownSources) })),
    removeLayer: vi.fn(() => map),
    removeSource: vi.fn(() => map),
    setFilter: vi.fn(() => map),
    setLayoutProperty: vi.fn(() => map),
  };

  return { addedLayers, knownSources, map: map as unknown as maplibregl.Map };
}

describe("map layer style spec", () => {
  it("accepts every paint expression the platform map adds", () => {
    const { addedLayers, knownSources, map } = createLayerCollectingMap();

    ensureMapLayers(
      map,
      "platform",
      true,
      false,
      "https://tiles.example/{z}/{x}/{y}",
      1,
    );
    ensureSpatialBoundaryLayer(map, boundaryGeoJson, true, new Set(["ba"]));

    const sources = Object.fromEntries(
      Array.from(knownSources, ([sourceId, spec]) => [
        sourceId,
        spec as Record<string, unknown>,
      ]),
    );
    const errors = validateStyleMin({
      version: 8,
      sources,
      layers: addedLayers,
    } as Parameters<typeof validateStyleMin>[0]);

    expect(errors.map((error) => error.message)).toEqual([]);
  });
});
