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
    setFilter = vi.fn(() => this);
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

const TILE_URL = "https://tiles.example/{z}/{x}/{y}";

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
        tileUrl={TILE_URL}
        imageSrc="data:image/png;base64,ready"
      />,
    );

    expect(MapConstructorMock).not.toHaveBeenCalled();
  });

  it("does not build a map before the batch resolves the tile URL", () => {
    render(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="anaseca"
        period="2024-01"
      />,
    );

    expect(MapConstructorMock).not.toHaveBeenCalled();
  });

  // Regressão: um período sem imagem no `panelLayer` fazia o item do relatório
  // sair com um retângulo cinza mudo, e ainda gastava um contexto WebGL.
  it("shows a message instead of a map when the period has no image", () => {
    const { getByText } = render(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="prev_anomalia_precipitacao"
        period="2026-05"
        unavailableReason="year_not_found"
      />,
    );

    expect(MapConstructorMock).not.toHaveBeenCalled();
    expect(getByText("Sem imagem do mapa para este período.")).toBeTruthy();
  });

  it("keeps the map out of the way when the tile URL failed for another reason", () => {
    const { getByText } = render(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="anaseca"
        period="2024-01"
        unavailableReason="rate_limited"
      />,
    );

    expect(MapConstructorMock).not.toHaveBeenCalled();
    expect(getByText("Mapa indisponível para exportação.")).toBeTruthy();
  });

  it("removes MapLibre when unmounted", async () => {
    const { unmount } = render(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="cancel-test-layer"
        period="2024-01"
        tileUrl={TILE_URL}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));

    unmount();

    expect(mapInstances[0].remove).toHaveBeenCalledTimes(1);
  });

  it("captures only once when MapLibre emits idle more than once", async () => {
    const onCapture = vi.fn();

    render(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="anaseca"
        period="2024-01"
        tileUrl={TILE_URL}
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
        tileUrl={TILE_URL}
        onCapture={firstCapture}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));

    rerender(
      <ReportMapPreview
        municipalityCode="5200050"
        layerId="anaseca"
        period="2024-01"
        tileUrl={TILE_URL}
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
        tileUrl={TILE_URL}
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
        tileUrl={TILE_URL}
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
        tileUrl={TILE_URL}
        attempt={1}
        onCapture={onCapture}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(2));
    expect(mapInstances[0].remove).toHaveBeenCalledTimes(1);
  });
});
