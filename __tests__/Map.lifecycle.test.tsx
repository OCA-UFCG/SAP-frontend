import { act, cleanup, render, waitFor } from "@testing-library/react";
import type { FeatureCollection, Geometry } from "geojson";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mapInstances, MapConstructorMock } = vi.hoisted(() => ({
  mapInstances: [] as Array<{
    addLayer: ReturnType<typeof vi.fn>;
    addSource: ReturnType<typeof vi.fn>;
    easeTo: ReturnType<typeof vi.fn>;
    fitBounds: ReturnType<typeof vi.fn>;
    getFeatureState: ReturnType<typeof vi.fn>;
    getLayer: ReturnType<typeof vi.fn>;
    getSource: ReturnType<typeof vi.fn>;
    getZoom: ReturnType<typeof vi.fn>;
    queryRenderedFeatures: ReturnType<typeof vi.fn>;
    isStyleLoaded: ReturnType<typeof vi.fn>;
    querySourceFeatures: ReturnType<typeof vi.fn>;
    handlers: Map<string, Array<(event: unknown) => void>>;
    on: ReturnType<typeof vi.fn>;
    once: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    setFeatureState: ReturnType<typeof vi.fn>;
    setLayoutProperty: ReturnType<typeof vi.fn>;
    setPadding: ReturnType<typeof vi.fn>;
    sources: Map<string, unknown>;
    sourceFeatures: Array<unknown>;
  }>,
  MapConstructorMock: vi.fn(),
}));

function mockElementWidth(element: HTMLElement, width: number) {
  Object.defineProperty(element, "getBoundingClientRect", {
    configurable: true,
    value: vi.fn(() => ({ width })),
  });
}

vi.mock("maplibre-gl", () => {
  type MapEventCallback = (event: unknown) => void;
  type SourceStub = { setData: ReturnType<typeof vi.fn>; spec: unknown };

  const MockPopup = class {
    remove = vi.fn();
    setLngLat = vi.fn(() => this);
    setText = vi.fn(() => this);
    addTo = vi.fn(() => this);
  };

  const MockMarker = class {
    remove = vi.fn();
    setLngLat = vi.fn(() => this);
    setPopup = vi.fn(() => this);
    addTo = vi.fn(() => this);
  };

  const MockMap = class {
    handlers = new globalThis.Map<string, MapEventCallback[]>();
    layers = new Set<string>();
    sources = new globalThis.Map<string, SourceStub>();
    sourceFeatures: Array<unknown> = [];

    addControl = vi.fn(() => this);
    jumpTo = vi.fn(() => this);
    on = vi.fn(
      (
        eventName: string,
        layerOrCallback: string | MapEventCallback,
        callback?: MapEventCallback,
      ) => {
        const eventKey =
          typeof layerOrCallback === "string"
            ? `${eventName}:${layerOrCallback}`
            : eventName;
        const eventCallback =
          typeof layerOrCallback === "string" ? callback : layerOrCallback;

        if (eventCallback) {
          const currentHandlers = this.handlers.get(eventKey) ?? [];
          this.handlers.set(eventKey, [...currentHandlers, eventCallback]);
        }

        return this;
      },
    );
    once = vi.fn((eventName: string, callback: MapEventCallback) => {
      const currentHandlers = this.handlers.get(eventName) ?? [];
      this.handlers.set(eventName, [...currentHandlers, callback]);
      return this;
    });
    off = vi.fn(
      (
        eventName: string,
        layerOrCallback?: string | MapEventCallback,
        callback?: MapEventCallback,
      ) => {
        const eventKey =
          typeof layerOrCallback === "string"
            ? `${eventName}:${layerOrCallback}`
            : eventName;
        const eventCallback =
          typeof layerOrCallback === "string" ? callback : layerOrCallback;

        const currentHandlers = this.handlers.get(eventKey) ?? [];
        this.handlers.set(
          eventKey,
          currentHandlers.filter((handler) => handler !== eventCallback),
        );

        return this;
      },
    );
    getSource = vi.fn((sourceId?: string) =>
      sourceId ? this.sources.get(sourceId) : undefined,
    );
    getLayer = vi.fn((layerId?: string) =>
      layerId && this.layers.has(layerId) ? {} : undefined,
    );
    getStyle = vi.fn(() => ({ sources: {} }));
    addSource = vi.fn((sourceId: string, spec: unknown) => {
      this.sources.set(sourceId, { setData: vi.fn(), spec });
      return this;
    });
    addLayer = vi.fn((layer: { id: string }) => {
      this.layers.add(layer.id);
      return this;
    });
    removeLayer = vi.fn(() => this);
    removeSource = vi.fn(() => this);
    isStyleLoaded = vi.fn(() => true);
    easeTo = vi.fn(() => this);
    fitBounds = vi.fn(() => this);
    getZoom = vi.fn(() => 4.2);
    queryRenderedFeatures = vi.fn(() => []);
    querySourceFeatures = vi.fn(() => this.sourceFeatures);
    setPadding = vi.fn(() => this);
    setFeatureState = vi.fn(() => this);
    getFeatureState = vi.fn(() => ({}));
    setLayoutProperty = vi.fn(() => this);
    getContainer = vi.fn(() => ({ clientWidth: 1280 }));
    getCanvas = vi.fn(() => ({ style: { cursor: "" } }));
    remove = vi.fn();
    scrollZoom = {
      disable: vi.fn(),
      enable: vi.fn(),
    };

    constructor(public readonly options: unknown) {
      MapConstructorMock(options);
      mapInstances.push(this);
    }
  };

  return {
    default: {
      Map: MockMap,
      Popup: MockPopup,
      Marker: MockMarker,
      AttributionControl: class {},
      NavigationControl: class {},
    },
    Map: MockMap,
    Popup: MockPopup,
    Marker: MockMarker,
    AttributionControl: class {},
    NavigationControl: class {},
  };
});

import Map from "@/components/Map/Map";
import { STATES_FILL_LAYER_ID } from "@/components/Map/mapDefinitions";
import {
  MUNICIPALITY_BORDER_MIN_ZOOM,
  MUNICIPALITY_BORDER_LAYER_ID,
  MUNICIPALITY_HOVER_LAYER_ID,
  MUNICIPALITY_MIN_ZOOM,
  MUNICIPALITY_SELECTED_BORDER_MIN_ZOOM,
  MUNICIPALITY_SOURCE_ID,
} from "@/components/Map/municipalityLayers";

describe("Map lifecycle", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.innerHTML = "";
    mapInstances.length = 0;
    MapConstructorMock.mockClear();
  });

  it("does not recreate the MapLibre instance when the selected state changes", () => {
    const { rerender, unmount } = render(
      <Map center={[-15.749997, -47.9499962]} estadoSelecionado="BR" />,
    );

    expect(MapConstructorMock).toHaveBeenCalledTimes(1);

    const firstInstance = mapInstances[0];
    expect(firstInstance).toBeDefined();

    rerender(<Map center={[-15.749997, -47.9499962]} estadoSelecionado="GO" />);

    expect(MapConstructorMock).toHaveBeenCalledTimes(1);
    expect(firstInstance.remove).not.toHaveBeenCalled();

    unmount();

    expect(firstInstance.remove).toHaveBeenCalledTimes(1);
  });

  it("reports the current zoom on load and after each zoom gesture", () => {
    const onZoomChange = vi.fn();

    render(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="BR"
        onZoomChange={onZoomChange}
      />,
    );

    const firstInstance = mapInstances[0];
    firstInstance.handlers.get("load")?.[0]?.({});

    expect(onZoomChange).toHaveBeenCalledWith(4.2);

    onZoomChange.mockClear();
    firstInstance.getZoom.mockReturnValue(6.5);
    firstInstance.handlers.get("zoomend")?.[0]?.({});

    expect(onZoomChange).toHaveBeenCalledWith(6.5);
  });

  it("adds municipality vector source and layers from the state focus zoom", () => {
    render(<Map center={[-15.749997, -47.9499962]} estadoSelecionado="BR" />);

    const firstInstance = mapInstances[0];
    firstInstance.handlers.get("load")?.[0]?.({});

    expect(firstInstance.addSource).toHaveBeenCalledWith(
      MUNICIPALITY_SOURCE_ID,
      expect.objectContaining({
        tiles: [expect.stringContaining("?tileset=cities")],
      }),
    );
    expect(firstInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MUNICIPALITY_BORDER_LAYER_ID,
        minzoom: MUNICIPALITY_SELECTED_BORDER_MIN_ZOOM,
        paint: expect.objectContaining({
          "line-opacity": [
            "step",
            ["zoom"],
            [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              0.95,
              0,
            ],
            MUNICIPALITY_BORDER_MIN_ZOOM,
            [
              "case",
              ["boolean", ["feature-state", "selected"], false],
              0.95,
              0.25,
            ],
          ],
        }),
      }),
      "state-borders",
    );
    expect(firstInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: MUNICIPALITY_HOVER_LAYER_ID,
        minzoom: MUNICIPALITY_MIN_ZOOM,
      }),
      "state-borders",
    );
  });

  it("keeps public boundary vector layers available in demo mode", () => {
    render(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="BR"
        mapMode="demo"
        tileLayerUrl="https://tiles.example/{z}/{x}/{y}"
      />,
    );

    const firstInstance = mapInstances[0];
    firstInstance.handlers.get("load")?.[0]?.({});

    expect(firstInstance.addSource).toHaveBeenCalledWith(
      "brazil-states",
      expect.objectContaining({
        tiles: [expect.stringContaining("/api/tiles/{z}/{x}/{y}")],
      }),
    );
    expect(firstInstance.addSource).toHaveBeenCalledWith(
      MUNICIPALITY_SOURCE_ID,
      expect.objectContaining({
        tiles: [expect.stringContaining("?tileset=cities")],
      }),
    );
    expect(firstInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: "state-borders" }),
    );
    expect(firstInstance.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({ id: MUNICIPALITY_BORDER_LAYER_ID }),
      "state-borders",
    );
    expect(firstInstance.addSource).not.toHaveBeenCalledWith(
      "gee-tiles",
      expect.anything(),
    );
  });

  it("limits Earth Engine raster tile requests to Brazil bounds", () => {
    render(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="BR"
        tileLayerUrl="https://tiles.example/{z}/{x}/{y}"
      />,
    );

    const firstInstance = mapInstances[0];
    firstInstance.handlers.get("load")?.[0]?.({});

    expect(firstInstance.addSource).toHaveBeenCalledWith(
      "gee-tiles",
      expect.objectContaining({
        type: "raster",
        tiles: ["https://tiles.example/{z}/{x}/{y}"],
        bounds: expect.arrayContaining([
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
          expect.any(Number),
        ]),
      }),
    );
    expect(firstInstance.addSource).not.toHaveBeenCalledWith(
      "gee-brazil-mask",
      expect.anything(),
    );
  });

  it("creates an Earth Engine raster with the selected opacity", () => {
    render(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="BR"
        layerOpacity={0.3}
        tileLayerUrl="https://tiles.example/{z}/{x}/{y}"
      />,
    );

    const firstInstance = mapInstances[0];
    firstInstance.handlers.get("load")?.[0]?.({});

    const geeLayer = firstInstance.addLayer.mock.calls
      .map(([layer]) => layer)
      .find((layer) => layer.id === "gee-layer");

    expect(geeLayer).toEqual(
      expect.objectContaining({
        paint: expect.objectContaining({ "raster-opacity": 0.3 }),
      }),
    );
  });

  it("documents that a boundary update waits for a later sync while the style is loading", async () => {
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

    const { rerender } = render(
      <Map center={[-15.749997, -47.9499962]} estadoSelecionado="BR" />,
    );
    const firstInstance = mapInstances[0];
    firstInstance.handlers.get("load")?.[0]?.({});
    firstInstance.addSource.mockClear();

    firstInstance.isStyleLoaded.mockReturnValue(false);
    rerender(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="BR"
        allowedStateUfs={new Set(["ba"])}
        spatialBoundaryGeoJson={boundaryGeoJson}
      />,
    );

    expect(firstInstance.addSource).not.toHaveBeenCalledWith(
      "spatial-boundary",
      expect.anything(),
    );

    // Finishing style loading alone does not retry the discarded prop update.
    firstInstance.isStyleLoaded.mockReturnValue(true);
    act(() => {
      firstInstance.handlers.get("idle")?.forEach((handler) => handler({}));
      firstInstance.handlers
        .get("styledata")
        ?.forEach((handler) => handler({}));
    });

    expect(firstInstance.addSource).not.toHaveBeenCalledWith(
      "spatial-boundary",
      expect.anything(),
    );

    // An unrelated later sync finally applies the boundary retained in the ref.
    rerender(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="BR"
        allowedStateUfs={new Set(["ba"])}
        spatialBoundaryGeoJson={boundaryGeoJson}
        tileLayerUrl="https://tiles.example/{z}/{x}/{y}"
      />,
    );

    await waitFor(() => {
      expect(firstInstance.addSource).toHaveBeenCalledWith(
        "spatial-boundary",
        expect.objectContaining({ data: boundaryGeoJson }),
      );
    });
  });

  it("registers municipality hover handlers", () => {
    render(<Map center={[-15.749997, -47.9499962]} estadoSelecionado="BR" />);

    const firstInstance = mapInstances[0];
    firstInstance.handlers.get("load")?.[0]?.({});

    expect(firstInstance.on).toHaveBeenCalledWith(
      "mousemove",
      MUNICIPALITY_HOVER_LAYER_ID,
      expect.any(Function),
    );
    expect(firstInstance.on).toHaveBeenCalledWith(
      "mouseleave",
      MUNICIPALITY_HOVER_LAYER_ID,
      expect.any(Function),
    );
  });

  it("focuses and highlights a selected municipality", () => {
    vi.useFakeTimers();

    render(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="SP"
        selectedMunicipalityCode="3509502"
      />,
    );

    const firstInstance = mapInstances[0];
    firstInstance.sourceFeatures = [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-47.1, -23.9],
              [-46.8, -23.9],
              [-46.8, -23.6],
              [-47.1, -23.6],
              [-47.1, -23.9],
            ],
          ],
        },
        properties: { CD_MUN: "3509502" },
      },
    ];

    firstInstance.handlers.get("load")?.[0]?.({});

    expect(firstInstance.setFeatureState).toHaveBeenCalledWith(
      expect.objectContaining({
        source: MUNICIPALITY_SOURCE_ID,
        id: "3509502",
      }),
      { selected: true },
    );
    expect(firstInstance.fitBounds).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        maxZoom: 14.5,
        animate: true,
        duration: 1200,
        padding: {
          bottom: 50,
          left: 50,
          right: 50,
          top: 50,
        },
      }),
    );
  });

  it("refocuses to a new municipality in the same state without requiring manual zoom interaction", () => {
    vi.useFakeTimers();

    const municipalityA = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-47.1, -23.9],
            [-46.8, -23.9],
            [-46.8, -23.6],
            [-47.1, -23.6],
            [-47.1, -23.9],
          ],
        ],
      },
      properties: { CD_MUN: "3509502" },
    };
    const municipalityB = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-49.3, -21.0],
            [-48.9, -21.0],
            [-48.9, -20.6],
            [-49.3, -20.6],
            [-49.3, -21.0],
          ],
        ],
      },
      properties: { CD_MUN: "3502804" },
    };

    const { rerender } = render(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="SP"
        selectedMunicipalityCode="3509502"
      />,
    );

    const firstInstance = mapInstances[0];
    firstInstance.querySourceFeatures.mockImplementation(() => [municipalityA]);

    firstInstance.handlers.get("load")?.[0]?.({});

    expect(firstInstance.setFeatureState).toHaveBeenCalledWith(
      expect.objectContaining({
        source: MUNICIPALITY_SOURCE_ID,
        id: "3509502",
      }),
      { selected: true },
    );

    firstInstance.fitBounds.mockClear();
    let municipalityBReady = false;
    firstInstance.querySourceFeatures.mockImplementation(() =>
      municipalityBReady ? [municipalityB] : [],
    );

    rerender(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="SP"
        selectedMunicipalityCode="3502804"
      />,
    );

    expect(firstInstance.fitBounds).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        maxZoom: 14.5,
        animate: true,
        duration: 1200,
        padding: {
          bottom: 50,
          left: 50,
          right: 50,
          top: 50,
        },
      }),
    );

    act(() => {
      vi.advanceTimersByTime(1349);
    });

    expect(firstInstance.fitBounds).not.toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({
        maxZoom: 11.5,
      }),
    );

    municipalityBReady = true;

    act(() => {
      vi.advanceTimersByTime(151);
    });

    expect(firstInstance.setFeatureState).toHaveBeenCalledWith(
      expect.objectContaining({
        source: MUNICIPALITY_SOURCE_ID,
        id: "3509502",
      }),
      { selected: false, hover: false },
    );
    expect(firstInstance.setFeatureState).toHaveBeenCalledWith(
      expect.objectContaining({
        source: MUNICIPALITY_SOURCE_ID,
        id: "3502804",
      }),
      { selected: true },
    );
    expect(firstInstance.fitBounds).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.objectContaining({
        maxZoom: 14.5,
        animate: true,
        duration: 1200,
        padding: {
          bottom: 50,
          left: 50,
          right: 50,
          top: 50,
        },
      }),
    );
  });

  it("keeps the municipality zoom flow pending when the municipality source is not ready yet", () => {
    vi.useFakeTimers();

    const municipality = {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [-47.1, -23.9],
            [-46.8, -23.9],
            [-46.8, -23.6],
            [-47.1, -23.6],
            [-47.1, -23.9],
          ],
        ],
      },
      properties: { CD_MUN: "3509502" },
    };

    const { rerender } = render(
      <Map center={[-15.749997, -47.9499962]} estadoSelecionado="SP" />,
    );

    const firstInstance = mapInstances[0];
    firstInstance.handlers.get("load")?.[0]?.({});

    const municipalitySource = firstInstance.sources.get(
      MUNICIPALITY_SOURCE_ID,
    );
    expect(municipalitySource).toBeDefined();

    firstInstance.fitBounds.mockClear();
    firstInstance.sources.delete(MUNICIPALITY_SOURCE_ID);

    rerender(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="SP"
        selectedMunicipalityCode="3509502"
      />,
    );

    firstInstance.sourceFeatures = [municipality];
    firstInstance.sources.set(MUNICIPALITY_SOURCE_ID, municipalitySource!);

    act(() => {
      vi.advanceTimersByTime(1350);
    });

    expect(firstInstance.fitBounds).toHaveBeenLastCalledWith(
      expect.any(Array),
      expect.objectContaining({
        maxZoom: 14.5,
        animate: true,
        duration: 1200,
        padding: {
          bottom: 50,
          left: 50,
          right: 50,
          top: 50,
        },
      }),
    );
  });

  it("falls back to local municipality bounds when queryable vector tiles are not ready yet", () => {
    vi.useFakeTimers();

    render(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="BA"
        selectedMunicipalityCode="2914802"
      />,
    );

    const firstInstance = mapInstances[0];
    firstInstance.querySourceFeatures.mockReturnValue([]);
    firstInstance.handlers.get("load")?.[0]?.({});

    const [bounds, options] = firstInstance.fitBounds.mock.lastCall ?? [];

    expect(bounds).toEqual([
      [-46.5599, -18.3372],
      [-37.3411, -8.5475],
    ]);
    expect(options).toEqual(
      expect.objectContaining({
        animate: false,
        padding: {
          bottom: 200,
          left: 200,
          right: 200,
          top: 200,
        },
      }),
    );
  });

  it("prioritizes a municipality click over state and background handlers", () => {
    const onSelectedMunicipalityCodeChange = vi.fn();
    const onStateSelect = vi.fn();
    const municipalityFeature = {
      id: "3509502",
      properties: { CD_MUN: "3509502", SIGLA_UF: "SP" },
    };

    render(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="SP"
        onSelectedMunicipalityCodeChange={onSelectedMunicipalityCodeChange}
        onStateSelect={onStateSelect}
      />,
    );

    const firstInstance = mapInstances[0];
    firstInstance.handlers.get("load")?.[0]?.({});
    firstInstance.queryRenderedFeatures.mockImplementation(
      (_point, options: { layers?: string[] }) =>
        options.layers?.includes(MUNICIPALITY_HOVER_LAYER_ID)
          ? [municipalityFeature]
          : [{ id: "SP", properties: { SIGLA_UF: "SP" } }],
    );

    firstInstance.handlers.get("click")?.[0]?.({ point: { x: 10, y: 10 } });

    expect(onSelectedMunicipalityCodeChange).toHaveBeenCalledTimes(1);
    expect(onSelectedMunicipalityCodeChange).toHaveBeenCalledWith("3509502");
    expect(onSelectedMunicipalityCodeChange).not.toHaveBeenCalledWith(null);
    expect(onStateSelect).not.toHaveBeenCalled();
  });

  it("toggles off the selected municipality without routing the click to the state", () => {
    const onSelectedMunicipalityCodeChange = vi.fn();
    const onStateSelect = vi.fn();

    render(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="SP"
        selectedMunicipalityCode="3509502"
        onSelectedMunicipalityCodeChange={onSelectedMunicipalityCodeChange}
        onStateSelect={onStateSelect}
      />,
    );

    const firstInstance = mapInstances[0];
    firstInstance.handlers.get("load")?.[0]?.({});
    firstInstance.queryRenderedFeatures.mockImplementation(
      (_point, options: { layers?: string[] }) =>
        options.layers?.includes(MUNICIPALITY_HOVER_LAYER_ID)
          ? [{ id: "3509502", properties: { CD_MUN: "3509502" } }]
          : [{ id: "SP", properties: { SIGLA_UF: "SP" } }],
    );
    onSelectedMunicipalityCodeChange.mockClear();

    firstInstance.handlers.get("click")?.[0]?.({ point: { x: 10, y: 10 } });

    expect(onSelectedMunicipalityCodeChange).toHaveBeenCalledTimes(1);
    expect(onSelectedMunicipalityCodeChange).toHaveBeenCalledWith(null);
    expect(onStateSelect).not.toHaveBeenCalled();
  });

  it("routes a non-municipality click to the state and clears the municipality", () => {
    const onSelectedMunicipalityCodeChange = vi.fn();
    const onStateSelect = vi.fn();

    render(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="SP"
        selectedMunicipalityCode="3509502"
        onSelectedMunicipalityCodeChange={onSelectedMunicipalityCodeChange}
        onStateSelect={onStateSelect}
      />,
    );

    const firstInstance = mapInstances[0];
    firstInstance.handlers.get("load")?.[0]?.({});
    firstInstance.queryRenderedFeatures.mockImplementation(
      (_point, options: { layers?: string[] }) =>
        options.layers?.includes(STATES_FILL_LAYER_ID)
          ? [{ id: "BA", properties: { SIGLA_UF: "BA" } }]
          : [],
    );
    onSelectedMunicipalityCodeChange.mockClear();

    firstInstance.handlers.get("click")?.[0]?.({ point: { x: 10, y: 10 } });

    expect(onSelectedMunicipalityCodeChange).toHaveBeenCalledTimes(1);
    expect(onSelectedMunicipalityCodeChange).toHaveBeenCalledWith(null);
    expect(onStateSelect).toHaveBeenCalledWith("BA");
  });

  it("keeps state clicks working in demo mode", () => {
    const onStateSelect = vi.fn();

    render(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="SP"
        mapMode="demo"
        onStateSelect={onStateSelect}
      />,
    );

    const firstInstance = mapInstances[0];
    firstInstance.handlers.get("load")?.[0]?.({});
    firstInstance.queryRenderedFeatures.mockReturnValue([
      { id: "BA", properties: { SIGLA_UF: "BA" } },
    ]);

    firstInstance.handlers.get("click")?.[0]?.({ point: { x: 10, y: 10 } });

    expect(firstInstance.queryRenderedFeatures).toHaveBeenCalledWith(
      { x: 10, y: 10 },
      { layers: [STATES_FILL_LAYER_ID] },
    );
    expect(onStateSelect).toHaveBeenCalledWith("BA");
  });

  it("clears the selected municipality when clicking outside a municipality", async () => {
    const onSelectedMunicipalityCodeChange = vi.fn();

    render(
      <Map
        center={[-15.749997, -47.9499962]}
        estadoSelecionado="SP"
        selectedMunicipalityCode="3509502"
        onSelectedMunicipalityCodeChange={onSelectedMunicipalityCodeChange}
      />,
    );

    const firstInstance = mapInstances[0];
    firstInstance.sourceFeatures = [
      {
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-47.1, -23.9],
              [-46.8, -23.9],
              [-46.8, -23.6],
              [-47.1, -23.6],
              [-47.1, -23.9],
            ],
          ],
        },
        properties: { CD_MUN: "3509502" },
      },
    ];

    firstInstance.handlers.get("load")?.[0]?.({});

    await waitFor(() => {
      expect(firstInstance.setFeatureState).toHaveBeenCalledWith(
        expect.objectContaining({
          source: MUNICIPALITY_SOURCE_ID,
          id: "3509502",
        }),
        { selected: true },
      );
    });

    firstInstance.handlers.get("click")?.[0]?.({ point: { x: 10, y: 10 } });

    await waitFor(() => {
      expect(firstInstance.setFeatureState).toHaveBeenCalledWith(
        expect.objectContaining({
          source: MUNICIPALITY_SOURCE_ID,
          id: "3509502",
        }),
        { selected: false, hover: false },
      );
      expect(onSelectedMunicipalityCodeChange).toHaveBeenCalledWith(null);
    });
  });

  it("enforces the municipality minimum zoom after fitting a selected state", () => {
    render(<Map center={[-15.749997, -47.9499962]} estadoSelecionado="AM" />);

    const firstInstance = mapInstances[0];
    firstInstance.handlers.get("moveend")?.[0]?.({});

    expect(firstInstance.easeTo).toHaveBeenCalledWith(
      expect.objectContaining({
        zoom: 5,
      }),
    );
  });

  it("keeps map padding aligned with the sidebar so centered zoom stays on the selected state", async () => {
    document.body.innerHTML = `
      <aside data-platform-sidebar-overlay>
        <div data-platform-side-rail></div>
        <div data-platform-side-panel></div>
      </aside>
    `;

    const sideRail = document.querySelector(
      "[data-platform-side-rail]",
    ) as HTMLElement;
    const sidePanel = document.querySelector(
      "[data-platform-side-panel]",
    ) as HTMLElement;

    mockElementWidth(sideRail, 140);
    mockElementWidth(sidePanel, 420);

    render(<Map center={[-15.749997, -47.9499962]} estadoSelecionado="GO" />);

    const firstInstance = mapInstances[0];

    await waitFor(() => {
      expect(firstInstance.setPadding).toHaveBeenLastCalledWith({
        top: 0,
        right: 0,
        bottom: 0,
        left: 560,
      });
      expect(firstInstance.fitBounds).toHaveBeenLastCalledWith(
        expect.any(Array),
        expect.objectContaining({
          padding: {
            top: 200,
            right: 200,
            bottom: 200,
            left: 200,
          },
        }),
      );
    });
  });
});
