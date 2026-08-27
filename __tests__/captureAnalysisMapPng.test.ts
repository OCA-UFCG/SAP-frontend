import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mapInstances, captureMock, applyStatesMock, ensureOverviewMock } =
  vi.hoisted(() => ({
    mapInstances: [] as Array<{
      handlers: Map<string, Array<() => void>>;
      remove: ReturnType<typeof vi.fn>;
      getSource: ReturnType<typeof vi.fn>;
      fire: (event: string) => void;
    }>,
    captureMock: vi.fn(),
    applyStatesMock: vi.fn(),
    ensureOverviewMock: vi.fn(),
  }));

vi.mock("maplibre-gl", () => {
  class MockMap {
    handlers = new Map<string, Array<() => void>>();
    remove = vi.fn();
    getSource = vi.fn(() => ({}));
    getLayer = vi.fn(() => undefined);
    addLayer = vi.fn();
    addSource = vi.fn();
    setFeatureState = vi.fn();

    constructor() {
      mapInstances.push(this as unknown as (typeof mapInstances)[number]);
    }

    on(event: string, callback: () => void) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), callback]);
      return this;
    }

    fire(event: string) {
      for (const callback of this.handlers.get(event) ?? []) callback();
    }
  }

  return { default: { Map: MockMap }, Map: MockMap };
});

vi.mock("@/components/Map/captureMapCanvas", () => ({
  captureMapCanvasPng: captureMock,
}));

vi.mock("@/components/Map/mapDefinitions", () => ({
  BASE_STYLE: { version: 8 },
  ensureMapLayers: vi.fn(),
  ensureSpatialBoundaryLayer: vi.fn(),
}));

vi.mock("@/components/Map/classificationLayers", () => ({
  CLASSIFICATION_SOURCES: [{ source: "brazil-cities" }],
  applyClassificationFeatureStates: applyStatesMock,
  ensureClassificationLayer: vi.fn(),
  ensureClassificationOverviewLayer: ensureOverviewMock,
}));

import { captureAnalysisMapPng } from "@/components/Amfe/exportAnalysisMapImage";

const OPTIONS = {
  classification: {
    classificationByCode: { "2500106": 4 },
    excludedCodes: [],
  },
  overviewGeoJson: { type: "FeatureCollection" as const, features: [] },
  boundaryGeoJson: null,
  allowedStateUfs: null,
  bounds: null,
};

beforeEach(() => {
  mapInstances.length = 0;
  captureMock.mockReset().mockReturnValue("data:image/png;base64,captured");
  applyStatesMock.mockReset();
  ensureOverviewMock.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("captureAnalysisMapPng", () => {
  it("resolves with the canvas png once the map goes idle", async () => {
    const pending = captureAnalysisMapPng(OPTIONS);
    const map = mapInstances[0];

    map.fire("load");
    map.fire("idle");

    await expect(pending).resolves.toBe("data:image/png;base64,captured");
    expect(applyStatesMock).toHaveBeenCalled();
    expect(ensureOverviewMock).toHaveBeenCalled();
  });

  it("still resolves when removing the map throws", async () => {
    const pending = captureAnalysisMapPng(OPTIONS);
    const map = mapInstances[0];
    map.remove.mockImplementation(() => {
      throw new Error("cannot remove during event dispatch");
    });

    map.fire("load");
    map.fire("idle");

    await expect(pending).resolves.toBe("data:image/png;base64,captured");
  });

  it("cleans up the offscreen container it appended to the document", async () => {
    const pending = captureAnalysisMapPng(OPTIONS);
    const map = mapInstances[0];

    expect(document.body.children).toHaveLength(1);

    map.fire("load");
    map.fire("idle");
    await pending;
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(map.remove).toHaveBeenCalled();
    expect(document.body.children).toHaveLength(0);
  });

  it("gives up when the webgl context is lost", async () => {
    const pending = captureAnalysisMapPng(OPTIONS);
    const map = mapInstances[0];

    map.fire("load");
    map.fire("webglcontextlost");

    await expect(pending).resolves.toBeNull();
    expect(captureMock).not.toHaveBeenCalled();
  });

  it("skips the choropleth when there is no analysis to paint", async () => {
    const pending = captureAnalysisMapPng({
      ...OPTIONS,
      classification: null,
    });
    const map = mapInstances[0];

    map.fire("load");
    map.fire("idle");
    await pending;

    expect(applyStatesMock).not.toHaveBeenCalled();
    expect(ensureOverviewMock).not.toHaveBeenCalled();
  });
});
