import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mapInstances, MapConstructorMock, prewarmMock } = vi.hoisted(() => ({
  mapInstances: [] as Array<{
    addLayer: ReturnType<typeof vi.fn>;
    addSource: ReturnType<typeof vi.fn>;
    areTilesLoaded: ReturnType<typeof vi.fn>;
    fitBounds: ReturnType<typeof vi.fn>;
    getCanvas: ReturnType<typeof vi.fn>;
    getLayer: ReturnType<typeof vi.fn>;
    getSource: ReturnType<typeof vi.fn>;
    handlers: Map<string, Array<(event?: unknown) => void>>;
    isSourceLoaded: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    on: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
    removeFeatureState: ReturnType<typeof vi.fn>;
    removeLayer: ReturnType<typeof vi.fn>;
    removeSource: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    setFeatureState: ReturnType<typeof vi.fn>;
  }>,
  MapConstructorMock: vi.fn(),
  prewarmMock: vi.fn(),
}));

vi.mock("maplibre-gl", () => {
  type MapEventCallback = (event?: unknown) => void;

  class MockMap {
    handlers = new globalThis.Map<string, MapEventCallback[]>();
    layers = new Set<string>();
    sources = new globalThis.Map<string, unknown>();

    on = vi.fn((eventName: string, callback: MapEventCallback) => {
      const currentHandlers = this.handlers.get(eventName) ?? [];
      this.handlers.set(eventName, [...currentHandlers, callback]);
      return this;
    });
    off = vi.fn((eventName: string, callback: MapEventCallback) => {
      const currentHandlers = this.handlers.get(eventName) ?? [];
      this.handlers.set(
        eventName,
        currentHandlers.filter((handler) => handler !== callback),
      );
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
    removeSource = vi.fn((sourceId: string) => {
      this.sources.delete(sourceId);
      return this;
    });
    removeLayer = vi.fn((layerId: string) => {
      this.layers.delete(layerId);
      return this;
    });
    isSourceLoaded = vi.fn(() => true);
    areTilesLoaded = vi.fn(() => true);
    resize = vi.fn(() => this);
    fitBounds = vi.fn(() => this);
    setFeatureState = vi.fn(() => this);
    removeFeatureState = vi.fn(() => this);
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

import { resolveReportTerritory } from "@/utils/reportTerritory";
import { ReportMapPreview } from "@/components/MunicipalReport/ReportMapPreview";
import {
  countIdleReportMaps,
  destroyReportMapPool,
} from "@/components/MunicipalReport/reportMapPool";

const TILE_URL = "https://tiles.example/{z}/{x}/{y}";

function emit(instanceIndex: number, eventName: string, event?: unknown) {
  const handlers = [
    ...(mapInstances[instanceIndex]?.handlers.get(eventName) ?? []),
  ];
  act(() => {
    for (const handler of handlers) handler(event);
  });
}

/**
 * O caminho que o MapLibre percorre até a captura: o raster reporta que
 * carregou e o mapa para de desenhar. O `sourcedata` é obrigatório porque um
 * mapa reaproveitado já está parado quando recebe a camada nova.
 */
function emitRasterReady(instanceIndex: number) {
  emit(instanceIndex, "sourcedata", { sourceId: "gee-tiles" });
  emit(instanceIndex, "idle");
}

/** Abadia de Goiás — GO, o município das asserções deste arquivo. */
const ABADIA_DE_GOIAS = resolveReportTerritory("5200050")!;

describe("ReportMapPreview", () => {
  beforeEach(() => {
    destroyReportMapPool();
    mapInstances.length = 0;
    MapConstructorMock.mockClear();
    prewarmMock.mockClear();
  });

  afterEach(() => {
    cleanup();
    destroyReportMapPool();
  });

  it("does not initialize MapLibre when an image is already available", () => {
    render(
      <ReportMapPreview
        territory={ABADIA_DE_GOIAS}
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
        territory={ABADIA_DE_GOIAS}
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
        territory={ABADIA_DE_GOIAS}
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
        territory={ABADIA_DE_GOIAS}
        layerId="anaseca"
        period="2024-01"
        unavailableReason="rate_limited"
      />,
    );

    expect(MapConstructorMock).not.toHaveBeenCalled();
    expect(getByText("Mapa indisponível para exportação.")).toBeTruthy();
  });

  // Antes cada item do relatório criava e destruía a própria instância: os 20
  // mapas gastavam 795 ms de mediana só até o evento `load`, recarregando vinte
  // vezes o mesmo estilo e a mesma malha municipal.
  it("devolve o mapa para a estante ao desmontar, em vez de destruí-lo", async () => {
    const { unmount } = render(
      <ReportMapPreview
        territory={ABADIA_DE_GOIAS}
        layerId="cancel-test-layer"
        period="2024-01"
        tileUrl={TILE_URL}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));
    emit(0, "load");
    await waitFor(() => expect(mapInstances[0].addLayer).toHaveBeenCalled());

    unmount();

    expect(mapInstances[0].remove).not.toHaveBeenCalled();
    expect(countIdleReportMaps()).toBe(1);
  });

  // Regressão: a espera pelo evento `load` fica pendente quando a fila desiste
  // do mapa antes dele, e a instância criada dentro de `acquireReportMap`
  // ficava órfã — um contexto WebGL preso que ninguém mais alcançava.
  it("descarta o mapa quando a fila desiste antes do estilo carregar", async () => {
    const { unmount } = render(
      <ReportMapPreview
        territory={ABADIA_DE_GOIAS}
        layerId="anaseca"
        period="2024-01"
        tileUrl={TILE_URL}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));

    unmount();

    await waitFor(() =>
      expect(mapInstances[0].remove).toHaveBeenCalledTimes(1),
    );
    expect(countIdleReportMaps()).toBe(0);
  });

  it("descarta a estante quando a prévia do relatório sai da tela", async () => {
    const { unmount } = render(
      <ReportMapPreview
        territory={ABADIA_DE_GOIAS}
        layerId="anaseca"
        period="2024-01"
        tileUrl={TILE_URL}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));
    emit(0, "load");
    await waitFor(() => expect(mapInstances[0].addLayer).toHaveBeenCalled());
    unmount();
    expect(countIdleReportMaps()).toBe(1);

    destroyReportMapPool();

    expect(countIdleReportMaps()).toBe(0);
    expect(mapInstances[0].remove).toHaveBeenCalledTimes(1);
  });

  it("limpa o raster e o município destacado ao devolver o mapa", async () => {
    const { unmount } = render(
      <ReportMapPreview
        territory={ABADIA_DE_GOIAS}
        layerId="anaseca"
        period="2024-01"
        tileUrl={TILE_URL}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));
    emit(0, "load");
    await waitFor(() => expect(mapInstances[0].addLayer).toHaveBeenCalled());

    unmount();

    // Sem esta limpeza a captura seguinte desenharia a camada anterior por cima
    // e destacaria o município errado.
    expect(mapInstances[0].removeLayer).toHaveBeenCalledWith("gee-layer");
    expect(mapInstances[0].removeSource).toHaveBeenCalledWith("gee-tiles");
    expect(mapInstances[0].removeFeatureState).toHaveBeenCalled();
  });

  it("reaproveita a mesma instância do MapLibre em outra camada", async () => {
    const firstCapture = vi.fn();
    const { unmount } = render(
      <ReportMapPreview
        territory={ABADIA_DE_GOIAS}
        layerId="anaseca"
        period="2024-01"
        tileUrl={TILE_URL}
        onCapture={firstCapture}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));
    emit(0, "load");
    await waitFor(() => expect(mapInstances[0].addLayer).toHaveBeenCalled());
    emitRasterReady(0);
    await waitFor(() => expect(firstCapture).toHaveBeenCalledTimes(1));
    unmount();

    const secondCapture = vi.fn();
    render(
      <ReportMapPreview
        territory={ABADIA_DE_GOIAS}
        layerId="indicearidez"
        period="2020"
        tileUrl={TILE_URL}
        onCapture={secondCapture}
      />,
    );

    await waitFor(() =>
      expect(mapInstances[0].resize).toHaveBeenCalledTimes(1),
    );
    emitRasterReady(0);

    await waitFor(() => expect(secondCapture).toHaveBeenCalledTimes(1));
    expect(MapConstructorMock).toHaveBeenCalledTimes(1);
  });

  it("captures only once when MapLibre emits idle more than once", async () => {
    const onCapture = vi.fn();

    render(
      <ReportMapPreview
        territory={ABADIA_DE_GOIAS}
        layerId="anaseca"
        period="2024-01"
        tileUrl={TILE_URL}
        onCapture={onCapture}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));

    emit(0, "load");
    await waitFor(() => expect(mapInstances[0].addLayer).toHaveBeenCalled());
    emitRasterReady(0);
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
        territory={ABADIA_DE_GOIAS}
        layerId="anaseca"
        period="2024-01"
        tileUrl={TILE_URL}
        onCapture={firstCapture}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));

    rerender(
      <ReportMapPreview
        territory={ABADIA_DE_GOIAS}
        layerId="anaseca"
        period="2024-01"
        tileUrl={TILE_URL}
        onCapture={secondCapture}
      />,
    );

    expect(mapInstances).toHaveLength(1);
    expect(mapInstances[0].remove).not.toHaveBeenCalled();

    emit(0, "load");
    await waitFor(() => expect(mapInstances[0].addLayer).toHaveBeenCalled());
    emitRasterReady(0);

    await waitFor(() => expect(secondCapture).toHaveBeenCalledTimes(1));
    expect(firstCapture).not.toHaveBeenCalled();
  });

  it("reports a null capture when canvas export fails", async () => {
    const onCapture = vi.fn();

    render(
      <ReportMapPreview
        territory={ABADIA_DE_GOIAS}
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
    await waitFor(() => expect(mapInstances[0].addLayer).toHaveBeenCalled());
    emitRasterReady(0);

    await waitFor(() => {
      expect(onCapture).toHaveBeenCalledTimes(1);
      expect(onCapture).toHaveBeenCalledWith(null);
    });
  });

  it("reaproveita o mapa da estante na nova tentativa da fila", async () => {
    const onCapture = vi.fn();
    const { rerender } = render(
      <ReportMapPreview
        territory={ABADIA_DE_GOIAS}
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
    await waitFor(() => expect(mapInstances[0].addLayer).toHaveBeenCalled());
    emitRasterReady(0);
    await waitFor(() => expect(onCapture).toHaveBeenCalledWith(null));

    rerender(
      <ReportMapPreview
        territory={ABADIA_DE_GOIAS}
        layerId="anaseca"
        period="2024-01"
        tileUrl={TILE_URL}
        attempt={1}
        onCapture={onCapture}
      />,
    );

    await waitFor(() =>
      expect(mapInstances[0].resize).toHaveBeenCalledTimes(1),
    );
    expect(mapInstances).toHaveLength(1);
    expect(mapInstances[0].remove).not.toHaveBeenCalled();
  });
});
