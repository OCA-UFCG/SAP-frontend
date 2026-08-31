import { describe, expect, it } from "vitest";
import type { AddLayerObject } from "maplibre-gl";
import {
  CLASSIFICATION_COLORS,
  CLASSIFICATION_FILL_COLOR,
  CLASSIFICATION_FILL_OPACITY,
  CLASSIFICATION_LAYER_ID,
  CLASSIFICATION_MIN_ZOOM,
  CLASSIFICATION_OUTLINE_LAYER_ID,
  CLASSIFICATION_OUTLINE_OPACITY,
  CLASSIFICATION_OVERVIEW_CODE_PROPERTY,
  CLASSIFICATION_OVERVIEW_LAYER_ID,
  CLASSIFICATION_OVERVIEW_OUTLINE_LAYER_ID,
  CLASSIFICATION_OVERVIEW_SOURCE_ID,
  CLASSIFICATION_MIN_ZOOM as FLOOR,
  ensureClassificationOverviewLayer,
  CLASSIFICATION_STATE_KEY,
  EXCLUDED_STATE_KEY,
  applyClassificationFeatureStates,
  clearClassificationFeatureStates,
  ensureClassificationLayer,
  type FeatureStateTarget,
} from "@/components/Map/classificationLayers";
import {
  MUNICIPALITY_HOVER_LAYER_ID,
  MUNICIPALITY_SOURCE_ID,
  MUNICIPALITY_SOURCE_LAYER,
} from "@/components/Map/municipalityLayers";

class FakeLayerMap {
  readonly addedLayers: Array<{
    layer: AddLayerObject;
    beforeId: string | undefined;
  }> = [];

  readonly addedSources: Array<{ id: string; source: unknown }> = [];

  constructor(
    private readonly existingLayerIds: Set<string>,
    private readonly existingSourceIds: Set<string>,
  ) {}

  getLayer(id: string) {
    return this.existingLayerIds.has(id) ? { id } : undefined;
  }

  getSource(id: string) {
    return this.existingSourceIds.has(id) ? { id } : undefined;
  }

  addLayer(layer: AddLayerObject, beforeId?: string) {
    this.existingLayerIds.add(layer.id);
    this.addedLayers.push({ layer, beforeId });
  }

  addSource(id: string, source: unknown) {
    this.existingSourceIds.add(id);
    this.addedSources.push({ id, source });
  }
}

class FakeFeatureStateMap {
  readonly states = new Map<string, Record<string, unknown>>();
  readonly removals: Array<{ id: string; key: string | undefined }> = [];
  readonly targets: FeatureStateTarget[] = [];

  setFeatureState(target: FeatureStateTarget, state: Record<string, unknown>) {
    this.targets.push(target);
    this.states.set(target.id, { ...this.states.get(target.id), ...state });
  }

  removeFeatureState(target: FeatureStateTarget, key?: string) {
    this.removals.push({ id: target.id, key });
    if (!key) {
      this.states.delete(target.id);
      return;
    }
    const current = this.states.get(target.id);
    if (current) delete current[key];
  }
}

const municipalitySourceReady = () =>
  new FakeLayerMap(
    new Set([MUNICIPALITY_HOVER_LAYER_ID]),
    new Set([MUNICIPALITY_SOURCE_ID]),
  );

describe("ensureClassificationLayer", () => {
  it("adds the choropleth below the hover highlight", () => {
    const map = municipalitySourceReady();

    ensureClassificationLayer(map);

    expect(map.addedLayers).toHaveLength(2);
    const [{ layer, beforeId }] = map.addedLayers;
    expect(layer.id).toBe(CLASSIFICATION_LAYER_ID);
    expect(beforeId).toBe(MUNICIPALITY_HOVER_LAYER_ID);
    expect(layer).toMatchObject({
      type: "fill",
      source: MUNICIPALITY_SOURCE_ID,
      "source-layer": MUNICIPALITY_SOURCE_LAYER,
      minzoom: CLASSIFICATION_MIN_ZOOM,
    });
  });

  it("outlines the painted municipalities above the fill", () => {
    const map = municipalitySourceReady();

    ensureClassificationLayer(map);

    // A divisa da source de municípios só fica visível a partir do zoom 7, e o
    // fit de uma análise estadual para antes disso: sem contorno próprio a
    // coropleta sairia como manchas contíguas de cor.
    const [fill, outline] = map.addedLayers;
    expect(fill.layer.id).toBe(CLASSIFICATION_LAYER_ID);
    expect(outline.layer.id).toBe(CLASSIFICATION_OUTLINE_LAYER_ID);
    expect(outline.beforeId).toBe(MUNICIPALITY_HOVER_LAYER_ID);
    expect(outline.layer).toMatchObject({
      type: "line",
      source: MUNICIPALITY_SOURCE_ID,
      "source-layer": MUNICIPALITY_SOURCE_LAYER,
      minzoom: CLASSIFICATION_MIN_ZOOM,
    });
  });

  it("is idempotent so repeated style syncs do not stack layers", () => {
    const map = municipalitySourceReady();

    ensureClassificationLayer(map);
    ensureClassificationLayer(map);

    expect(map.addedLayers).toHaveLength(2);
  });

  it("does nothing until the municipality source exists", () => {
    const map = new FakeLayerMap(new Set(), new Set());

    ensureClassificationLayer(map);

    expect(map.addedLayers).toHaveLength(0);
  });

  it("appends on top when the hover layer is not present yet", () => {
    const map = new FakeLayerMap(new Set(), new Set([MUNICIPALITY_SOURCE_ID]));

    ensureClassificationLayer(map);

    expect(map.addedLayers[0].beforeId).toBeUndefined();
  });
});

describe("classification paint expressions", () => {
  it("maps every priority level to its colour", () => {
    CLASSIFICATION_COLORS.forEach((color, level) => {
      const branchIndex = CLASSIFICATION_FILL_COLOR.indexOf(
        color as never,
      );
      expect(branchIndex).toBeGreaterThan(0);
      expect(CLASSIFICATION_FILL_COLOR[branchIndex - 1]).toEqual([
        "==",
        ["feature-state", CLASSIFICATION_STATE_KEY],
        level,
      ]);
    });
  });

  it("falls back to fully transparent for unranked municipalities", () => {
    expect(CLASSIFICATION_FILL_COLOR.at(-1)).toBe("transparent");
    expect(CLASSIFICATION_FILL_OPACITY.at(-1)).toBe(0);
  });

  it("keeps the outline off where the analysis left no feature-state", () => {
    // O contorno divide só o que a análise pintou; desenhá-lo em toda a source
    // encheria o país de divisas fora da área de interesse.
    expect(CLASSIFICATION_OUTLINE_OPACITY.at(-1)).toBe(0);
  });

  it("never coerces the feature-state through to-number", () => {
    // to-number(null) devolve 0, o que pintaria município sem dado como
    // prioridade muito baixa. A cadeia precisa usar comparações explícitas.
    expect(JSON.stringify(CLASSIFICATION_FILL_COLOR)).not.toContain(
      "to-number",
    );
  });
});

describe("applyClassificationFeatureStates", () => {
  it("writes the priority level for each ranked municipality", () => {
    const map = new FakeFeatureStateMap();

    const applied = applyClassificationFeatureStates(map, {
      classificationByCode: { "2504108": 3, "2507507": 0 },
      excludedCodes: [],
    });

    expect(map.states.get("2504108")).toEqual({
      [CLASSIFICATION_STATE_KEY]: 3,
    });
    expect(map.states.get("2507507")).toEqual({
      [CLASSIFICATION_STATE_KEY]: 0,
    });
    expect(applied).toEqual(new Set(["2504108", "2507507"]));
  });

  it("flags excluded municipalities without a priority level", () => {
    const map = new FakeFeatureStateMap();

    applyClassificationFeatureStates(map, {
      classificationByCode: {},
      excludedCodes: ["1100015"],
    });

    expect(map.states.get("1100015")).toEqual({ [EXCLUDED_STATE_KEY]: true });
  });

  it("keeps the ranking when a code is both ranked and listed as excluded", () => {
    const map = new FakeFeatureStateMap();

    applyClassificationFeatureStates(map, {
      classificationByCode: { "2504108": 4 },
      excludedCodes: ["2504108"],
    });

    expect(map.states.get("2504108")).toEqual({
      [CLASSIFICATION_STATE_KEY]: 4,
    });
  });
});

describe("ensureClassificationOverviewLayer", () => {
  const overview = {
    type: "FeatureCollection" as const,
    features: [],
  };

  it("covers exactly the zoom range the vector tiles cannot reach", () => {
    const map = municipalitySourceReady();

    ensureClassificationOverviewLayer(map, overview);

    // maxzoom da visão geral == minzoom dos tiles: as duas nunca desenham
    // juntas, e não sobra faixa de zoom sem cor.
    const [fill, outline] = map.addedLayers;
    expect(fill.layer).toMatchObject({
      id: CLASSIFICATION_OVERVIEW_LAYER_ID,
      type: "fill",
      source: CLASSIFICATION_OVERVIEW_SOURCE_ID,
      maxzoom: FLOOR,
    });
    expect(outline.layer).toMatchObject({
      id: CLASSIFICATION_OVERVIEW_OUTLINE_LAYER_ID,
      type: "line",
      maxzoom: FLOOR,
    });
    expect(fill.layer).not.toHaveProperty("minzoom");
    expect(fill.layer).not.toHaveProperty("source-layer");
  });

  it("promotes the IBGE code so the analysis can address the features", () => {
    const map = municipalitySourceReady();

    ensureClassificationOverviewLayer(map, overview);

    expect(map.addedSources).toEqual([
      {
        id: CLASSIFICATION_OVERVIEW_SOURCE_ID,
        source: expect.objectContaining({
          type: "geojson",
          promoteId: CLASSIFICATION_OVERVIEW_CODE_PROPERTY,
        }),
      },
    ]);
  });

  it("is idempotent across style reloads", () => {
    const map = municipalitySourceReady();

    ensureClassificationOverviewLayer(map, overview);
    ensureClassificationOverviewLayer(map, overview);

    expect(map.addedLayers).toHaveLength(2);
    expect(map.addedSources).toHaveLength(1);
  });
});

describe("feature-state across both choropleth sources", () => {
  it("paints the same municipality on tiles and on the overview", () => {
    const map = new FakeFeatureStateMap();

    applyClassificationFeatureStates(map, {
      classificationByCode: { "2504108": 3 },
      excludedCodes: [],
    });

    // Sem escrever nas duas, o município perde a cor ao cruzar o zoom 5.
    expect(map.targets.map((target) => target.source)).toEqual([
      MUNICIPALITY_SOURCE_ID,
      CLASSIFICATION_OVERVIEW_SOURCE_ID,
    ]);
  });
});

describe("clearClassificationFeatureStates", () => {
  it("removes only the AMFE keys so hover and selection survive", () => {
    const map = new FakeFeatureStateMap();
    map.setFeatureState(
      {
        source: MUNICIPALITY_SOURCE_ID,
        sourceLayer: MUNICIPALITY_SOURCE_LAYER,
        id: "2504108",
      },
      { hover: true, [CLASSIFICATION_STATE_KEY]: 2 },
    );

    clearClassificationFeatureStates(map, ["2504108"], [
      { source: MUNICIPALITY_SOURCE_ID, sourceLayer: MUNICIPALITY_SOURCE_LAYER },
    ]);

    expect(map.states.get("2504108")).toEqual({ hover: true });
    expect(map.removals.map((removal) => removal.key)).toEqual([
      CLASSIFICATION_STATE_KEY,
      EXCLUDED_STATE_KEY,
    ]);
  });
});
