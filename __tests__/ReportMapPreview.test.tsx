import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mapInstances, MapConstructorMock, prewarmMock } = vi.hoisted(() => ({
  mapInstances: [] as Array<{
    addLayer: ReturnType<typeof vi.fn>;
    addSource: ReturnType<typeof vi.fn>;
    fitBounds: ReturnType<typeof vi.fn>;
    getCanvas: ReturnType<typeof vi.fn>;
    getLayer: ReturnType<typeof vi.fn>;
    getSource: ReturnType<typeof vi.fn>;
    handlers: Map<string, Array<() => void>>;
    on: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    setFeatureState: ReturnType<typeof vi.fn>;
  }>,
  MapConstructorMock: vi.fn(),
  prewarmMock: vi.fn(),
}));

vi.mock("maplibre-gl", () => {
  type MapEventCallback = () => void;

  class MockMap {
    handlers = new globalThis.Map<string, MapEventCallback[]>();
    layers = new Set<string>();
    sources = new globalThis.Map<string, unknown>();

    on = vi.fn((eventName: string, callback: MapEventCallback) => {
      const currentHandlers = this.handlers.get(eventName) ?? [];
      this.handlers.set(eventName, [...currentHandlers, callback]);
      return this;
    });
    getSource = vi.fn((sourceId?: string) =>
      sourceId ? this.sources.get(sourceId) : undefined,
    );
    getLayer = vi.fn((layerId?: string) =>
      layerId && this.layers.has(layerId) ? {} : undefined,
    );
    addSource = vi.fn((sourceId: string, spec: unknown) => {
      this.sources.set(sourceId, spec);
      return this;
    });
    addLayer = vi.fn((layer: { id: string }) => {
      this.layers.add(layer.id);
      return this;
    });
    fitBounds = vi.fn(() => this);
    setFeatureState = vi.fn(() => this);
    getCanvas = vi.fn(() => ({
      toDataURL: vi.fn(() => `data:image/png;base64,${"a".repeat(120)}`),
    }));
    remove = vi.fn();

    constructor(public readonly options: unknown) {
      MapConstructorMock(options);
      mapInstances.push(this);
    }
  }

  return {
    default: { Map: MockMap, prewarm: prewarmMock },
    Map: MockMap,
    prewarm: prewarmMock,
  };
});

vi.mock("@/services/mapServices", () => ({
  fetchMapURL: vi.fn(),
}));

vi.mock("@/components/Map/municipalityLayers", () => ({
  MUNICIPALITY_BORDER_LAYER_ID: "municipality-borders",
  MUNICIPALITY_SOURCE_ID: "brazil-cities",
  MUNICIPALITY_SOURCE_LAYER: "brazilcities",
  ensureMunicipalityLayers: vi.fn((map) => {
    map.addSource("brazil-cities", { type: "vector" });
    map.addLayer({ id: "municipality-borders" });
  }),
}));

vi.mock("@/components/Map/mapBounds", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/components/Map/mapBounds")>();
  return {
    ...actual,
    getIndexedMunicipalityBounds: vi.fn(() => [
      [-47.1, -16.1],
      [-46.9, -15.9],
    ]),
  };
});

import { ReportMapPreview } from "@/components/MunicipalReport/ReportMapPreview";
import { fetchMapURL } from "@/services/mapServices";

const mockedFetchMapURL = vi.mocked(fetchMapURL);

function emit(instanceIndex: number, eventName: string) {
  const handlers = mapInstances[instanceIndex]?.handlers.get(eventName) ?? [];
  act(() => {
    for (const handler of handlers) handler();
  });
}

describe("ReportMapPreview", () => {
  beforeEach(() => {
    mapInstances.length = 0;
    MapConstructorMock.mockClear();
    prewarmMock.mockClear();
    mockedFetchMapURL.mockReset();
    mockedFetchMapURL.mockResolvedValue("https://tiles.example/{z}/{x}/{y}");
  });

  afterEach(() => {
    cleanup();
  });

  it("does not initialize MapLibre when an image is already available", () => {
    render(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="anaseca"
        period="2024-01"
        imageSrc="data:image/png;base64,ready"
      />,
    );

    expect(MapConstructorMock).not.toHaveBeenCalled();
    expect(mockedFetchMapURL).not.toHaveBeenCalled();
  });

  it("passes an AbortSignal to the tile URL request", async () => {
    render(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="anaseca"
        period="2024-01"
      />,
    );

    await waitFor(() => {
      expect(mockedFetchMapURL).toHaveBeenCalledWith(
        "anaseca",
        "2024-01",
        expect.any(AbortSignal),
      );
    });
  });

  it("aborts pending work and removes MapLibre when unmounted", async () => {
    const { unmount } = render(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="cancel-test-layer"
        period="2024-01"
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));
    const signal = mockedFetchMapURL.mock.calls[0][2];

    unmount();

    expect(signal?.aborted).toBe(true);
    expect(mapInstances[0].remove).toHaveBeenCalledTimes(1);
  });

  it("captures only once when MapLibre emits idle more than once", async () => {
    const onCapture = vi.fn();

    render(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="anaseca"
        period="2024-01"
        onCapture={onCapture}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));

    emit(0, "load");
    emit(0, "idle");
    emit(0, "idle");

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledTimes(1);
      expect(onCapture).toHaveBeenCalledWith(
        expect.stringMatching(/^data:image\/png;base64,/),
      );
    });

    expect(MapConstructorMock).toHaveBeenCalledWith(
      expect.objectContaining({
        preserveDrawingBuffer: true,
        interactive: false,
      }),
    );
    expect(mapInstances[0].fitBounds).toHaveBeenCalledWith(
      [
        [-47.1, -16.1],
        [-46.9, -15.9],
      ],
      expect.objectContaining({ animate: false }),
    );
  });

  it("does not restart an active map when the capture callback changes", async () => {
    const firstCapture = vi.fn();
    const secondCapture = vi.fn();
    const { rerender } = render(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="anaseca"
        period="2024-01"
        onCapture={firstCapture}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));

    rerender(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="anaseca"
        period="2024-01"
        onCapture={secondCapture}
      />,
    );

    expect(mapInstances).toHaveLength(1);
    expect(mapInstances[0].remove).not.toHaveBeenCalled();

    emit(0, "load");
    emit(0, "idle");

    await waitFor(() => expect(secondCapture).toHaveBeenCalledTimes(1));
    expect(firstCapture).not.toHaveBeenCalled();
  });

  it("reports a null capture when canvas export fails", async () => {
    const onCapture = vi.fn();

    render(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="anaseca"
        period="2024-01"
        onCapture={onCapture}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));
    mapInstances[0].getCanvas.mockReturnValueOnce({
      toDataURL: vi.fn(() => {
        throw new Error("tainted canvas");
      }),
    });

    emit(0, "load");
    emit(0, "idle");

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledTimes(1);
      expect(onCapture).toHaveBeenCalledWith(null);
    });
  });

  it("creates a fresh map when a serial retry attempt is requested", async () => {
    const onCapture = vi.fn();
    const { rerender } = render(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="anaseca"
        period="2024-01"
        attempt={0}
        onCapture={onCapture}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));
    mapInstances[0].getCanvas.mockReturnValueOnce({
      toDataURL: vi.fn(() => {
        throw new Error("context lost");
      }),
    });
    emit(0, "load");
    emit(0, "idle");
    await waitFor(() => expect(onCapture).toHaveBeenCalledWith(null));

    rerender(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="anaseca"
        period="2024-01"
        attempt={1}
        onCapture={onCapture}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(2));
    expect(mapInstances[0].remove).toHaveBeenCalledTimes(1);
  });
});
