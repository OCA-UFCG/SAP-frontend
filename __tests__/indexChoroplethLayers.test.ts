import { describe, expect, it } from "vitest";
import type { AddLayerObject, ExpressionSpecification } from "maplibre-gl";

import { isChoroplethImageData } from "@/contracts/imageDataContract.mjs";
import {
  INDEX_CHOROPLETH_LAYER_ID,
  INDEX_CHOROPLETH_OUTLINE_LAYER_ID,
  INDEX_CHOROPLETH_OVERVIEW_LAYER_ID,
  INDEX_CHOROPLETH_STATE_KEY,
  applyIndexChoroplethStates,
  buildChoroplethFillColor,
  clearIndexChoroplethStates,
  ensureIndexChoroplethLayers,
  removeIndexChoroplethLayers,
} from "@/components/Map/indexChoroplethLayers";
import {
  CLASSIFICATION_MIN_ZOOM,
  CLASSIFICATION_OVERVIEW_SOURCE_ID,
  type FeatureStateTarget,
  type MunicipalityOverviewGeoJson,
} from "@/components/Map/classificationLayers";
import { MUNICIPALITY_SOURCE_ID } from "@/components/Map/municipalityLayers";

const PALETTE = ["#FEE5D9", "#FC9272", "#DE2D26"];

const OVERVIEW: MunicipalityOverviewGeoJson = {
  type: "FeatureCollection",
  features: [],
};

/** Um mapa do MapLibre reduzido ao que este módulo chama. */
class FakeChoroplethMap {
  readonly layers = new Map<string, AddLayerObject>();
  readonly sources = new Set<string>([MUNICIPALITY_SOURCE_ID]);
  readonly states: Array<{ target: FeatureStateTarget; state: unknown }> = [];
  readonly removedStates: Array<{ target: FeatureStateTarget; key?: string }> =
    [];

  getLayer(id: string) {
    return this.layers.get(id);
  }
  getSource(id: string) {
    return this.sources.has(id) ? { id } : undefined;
  }
  addSource(id: string) {
    this.sources.add(id);
  }
  addLayer(layer: AddLayerObject) {
    this.layers.set(layer.id, layer);
  }
  removeLayer(id: string) {
    this.layers.delete(id);
  }
  setPaintProperty() {}
  setFeatureState(target: FeatureStateTarget, state: Record<string, unknown>) {
    this.states.push({ target, state });
  }
  removeFeatureState(target: FeatureStateTarget, key?: string) {
    this.removedStates.push({ target, key });
  }
}

describe("buildChoroplethFillColor", () => {
  it("paints each range with its own colour and leaves the rest transparent", () => {
    const expression = buildChoroplethFillColor(
      PALETTE,
    ) as unknown as unknown[];

    expect(expression[0]).toBe("case");
    expect(expression).toContain("#DE2D26");
    expect(expression.at(-1)).toBe("transparent");
  });

  it("reads the range from the feature-state of the choropleth only", () => {
    const expression = JSON.stringify(
      buildChoroplethFillColor(PALETTE) as unknown as ExpressionSpecification,
    );

    expect(expression).toContain(INDEX_CHOROPLETH_STATE_KEY);
  });
});

describe("ensureIndexChoroplethLayers", () => {
  it("adds the tile layers above the overview floor and the overview below it", () => {
    const map = new FakeChoroplethMap();

    ensureIndexChoroplethLayers(map, PALETTE, OVERVIEW, 0.85);

    expect(map.getLayer(INDEX_CHOROPLETH_LAYER_ID)).toMatchObject({
      minzoom: CLASSIFICATION_MIN_ZOOM,
    });
    expect(map.getLayer(INDEX_CHOROPLETH_OVERVIEW_LAYER_ID)).toMatchObject({
      maxzoom: CLASSIFICATION_MIN_ZOOM,
    });
    expect(map.sources.has(CLASSIFICATION_OVERVIEW_SOURCE_ID)).toBe(true);
  });

  it("does nothing while the municipality tiles are not on the map yet", () => {
    const map = new FakeChoroplethMap();
    map.sources.delete(MUNICIPALITY_SOURCE_ID);

    ensureIndexChoroplethLayers(map, PALETTE, OVERVIEW, 0.85);

    expect(map.layers.size).toBe(0);
  });

  it("removes every layer it added when the index stops being a choropleth", () => {
    const map = new FakeChoroplethMap();
    ensureIndexChoroplethLayers(map, PALETTE, OVERVIEW, 0.85);

    removeIndexChoroplethLayers(map);

    expect(map.layers.size).toBe(0);
    expect(map.getLayer(INDEX_CHOROPLETH_OUTLINE_LAYER_ID)).toBeUndefined();
  });
});

describe("index choropleth feature states", () => {
  it("writes the range of each municipality on both municipality sources", () => {
    const map = new FakeChoroplethMap();

    const applied = applyIndexChoroplethStates(map, { "2507507": 2 });

    expect(applied).toEqual(new Set(["2507507"]));
    expect(map.states).toHaveLength(2);
    expect(map.states[0].state).toEqual({ [INDEX_CHOROPLETH_STATE_KEY]: 2 });
  });

  it("clears only its own key, leaving hover and selection alone", () => {
    const map = new FakeChoroplethMap();

    clearIndexChoroplethStates(map, ["2507507"]);

    expect(
      map.removedStates.every(
        (removed) => removed.key === INDEX_CHOROPLETH_STATE_KEY,
      ),
    ).toBe(true);
  });
});

describe("isChoroplethImageData", () => {
  const choroplethImageData = {
    schemaVersion: 1,
    type: "territorial-compact",
    defaultYear: "2020",
    classes: [{ id: "pib", label: "PIB", color: "#F00" }],
    locations: { br: "Brasil" },
    mapVisualization: { sourceType: "municipalChoropleth" },
    years: { "2020": { valuesScale: 1, values: {} } },
  };

  it("recognises an imageData whose map is painted in the browser", () => {
    expect(isChoroplethImageData(choroplethImageData)).toBe(true);
    expect(
      isChoroplethImageData({
        ...choroplethImageData,
        mapVisualization: { sourceType: "image" },
      }),
    ).toBe(false);
  });
});
