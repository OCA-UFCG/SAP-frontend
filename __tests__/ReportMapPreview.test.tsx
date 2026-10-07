import { act, cleanup, render, waitFor } from "@testing-library/react";
import type maplibregl from "maplibre-gl";
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
    triggerRepaint: ReturnType<typeof vi.fn>;
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
    moveLayer = vi.fn(() => this);
    triggerRepaint = vi.fn();
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
import { REPORT_MAP_CAPTURE_TIMEOUT_MS } from "@/components/MunicipalReport/ReportMapPreview";

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
/** Um recorte agregado, que desenha contorno próprio em vez da malha municipal. */
const CAATINGA = resolveReportTerritory("3_bioma-caatinga")!;

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

  // Regressão: um índice de planilha não tem asset no Earth Engine, e o quadro
  // só sabia desenhar tiles — a prévia do relatório saía com o mapa vazio.
  it("pinta a coropleta de um índice de planilha, sem URL de tiles", async () => {
    const onCapture = vi.fn();
    const { unmount } = render(
      <ReportMapPreview
        territory={ABADIA_DE_GOIAS}
        layerId="pobreza_urbana"
        period="2025"
        choropleth={{
          palette: ["#fee", "#f00"],
          classByCode: { "5200050": 1 },
        }}
        onCapture={onCapture}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));
    emit(0, "load");
    await waitFor(() =>
      expect(mapInstances[0].addLayer).toHaveBeenCalledWith(
        expect.objectContaining({ id: "index-choropleth-fills" }),
        undefined,
      ),
    );
    expect(mapInstances[0].addSource).not.toHaveBeenCalledWith(
      "gee-tiles",
      expect.anything(),
    );
    expect(mapInstances[0].setFeatureState).toHaveBeenCalledWith(
      expect.objectContaining({ id: "5200050" }),
      { indexChoroplethClass: 1 },
    );
    // A fonte de visão geral não existe neste mapa: gravar nela era um erro no
    // console por município.
    expect(mapInstances[0].setFeatureState).not.toHaveBeenCalledWith(
      expect.objectContaining({ source: "amfe-cities-overview" }),
      expect.anything(),
    );

    emit(0, "idle");
    await waitFor(() =>
      expect(onCapture).toHaveBeenCalledWith(expect.any(String)),
    );

    unmount();
    expect(mapInstances[0].removeLayer).toHaveBeenCalledWith(
      "index-choropleth-fills",
    );
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

  // Regressão: o estilo do relatório tinha nascido vazio por desempenho, e o
  // PNG capturado saía com o índice recortado sobre o branco do canvas em todo
  // recorte — município, estado, bioma, ASD.
  it("desenha o índice sobre o mapa de fundo, e não sobre o branco do canvas", async () => {
    render(
      <ReportMapPreview
        territory={CAATINGA}
        layerId="anaseca"
        period="2024-01"
        tileUrl={TILE_URL}
      />,
    );

    await waitFor(() => expect(MapConstructorMock).toHaveBeenCalled());
    const { style } = MapConstructorMock.mock.calls[0][0] as {
      style: maplibregl.StyleSpecification;
    };

    expect(style.sources["osm-base"]).toBeTruthy();
    // Primeira camada do estilo: tudo o que o relatório acrescenta depois
    // — malha municipal, raster do índice, contorno do território — fica
    // por cima do fundo.
    expect(style.layers[0].id).toBe("osm-layer");
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

  // Regressão: o contorno do território ficava no mapa devolvido para a
  // estante, e a captura seguinte morria em `Source "report-territory-outline"
  // already exists`, deixando o relatório sem mapa a partir do segundo índice.
  it("limpa também o contorno do território ao devolver o mapa", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: { name: "Caatinga" },
              geometry: { type: "Point", coordinates: [-38, -7] },
            },
          ],
        }),
      })),
    );

    const { unmount } = render(
      <ReportMapPreview
        territory={CAATINGA}
        layerId="anaseca"
        period="2024-01"
        tileUrl={TILE_URL}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));
    emit(0, "load");
    await waitFor(() => expect(mapInstances[0].addLayer).toHaveBeenCalled());

    unmount();

    expect(mapInstances[0].removeLayer).toHaveBeenCalledWith(
      "report-territory-outline-line",
    );
    expect(mapInstances[0].removeSource).toHaveBeenCalledWith(
      "report-territory-outline",
    );
    vi.unstubAllGlobals();
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

  // Regressão: sem prazo, uma imagem que a rede nunca entregava deixava o
  // relatório de São Paulo em "1 mapa restante" para sempre.
  describe("quando a captura não termina", () => {
    afterEach(() => {
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    it("desiste depois do prazo e não devolve o mapa travado para a estante", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      vi.spyOn(console, "warn").mockImplementation(() => {});
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
      emit(0, "load");
      await waitFor(() => expect(mapInstances[0].addLayer).toHaveBeenCalled());

      act(() => {
        vi.advanceTimersByTime(REPORT_MAP_CAPTURE_TIMEOUT_MS - 1000);
      });
      expect(onCapture).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1000);
      });
      expect(onCapture).toHaveBeenCalledWith(null);

      // A fila manda a nova tentativa: ela precisa de um mapa novo.
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

      expect(mapInstances[0].remove).toHaveBeenCalledTimes(1);
      await waitFor(() => expect(mapInstances).toHaveLength(2));
    });

    it("não conta o tempo em que a aba ficou em segundo plano", async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      let hidden = false;
      vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
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
      hidden = true;
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
        vi.advanceTimersByTime(REPORT_MAP_CAPTURE_TIMEOUT_MS * 3);
      });
      expect(onCapture).not.toHaveBeenCalled();

      hidden = false;
      act(() => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      emit(0, "load");
      await waitFor(() => expect(mapInstances[0].addLayer).toHaveBeenCalled());
      emitRasterReady(0);

      await waitFor(() =>
        expect(onCapture).toHaveBeenCalledWith(
          expect.stringMatching(/^data:image\/png;base64,/),
        ),
      );
    });

    it("avisa a fila quando a montagem do mapa lança erro", async () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
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
      mapInstances[0].addSource.mockImplementationOnce(() => {
        throw new Error("There is already a source with this ID");
      });
      emit(0, "load");

      await waitFor(() => expect(onCapture).toHaveBeenCalledWith(null));
    });
  });

  // Regressão: o contorno de bioma, semiárido e ASD é buscado na rede. Se o
  // raster terminasse durante a busca, o aviso dele se perdia e o mapa
  // esperava para sempre.
  it("captura o raster que terminou enquanto o contorno ainda chegava", async () => {
    let deliverOutline: () => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise((resolve) => {
            deliverOutline = () =>
              resolve({
                ok: true,
                json: async () => ({
                  type: "FeatureCollection",
                  features: [
                    {
                      type: "Feature",
                      properties: { name: "Caatinga" },
                      geometry: { type: "Point", coordinates: [-38, -7] },
                    },
                  ],
                }),
              });
          }),
      ),
    );
    const onCapture = vi.fn();
    render(
      <ReportMapPreview
        territory={CAATINGA}
        layerId="anaseca"
        period="2024-01"
        tileUrl={TILE_URL}
        onCapture={onCapture}
      />,
    );

    await waitFor(() => expect(mapInstances).toHaveLength(1));
    emit(0, "load");
    await waitFor(() => expect(fetch).toHaveBeenCalled());

    // O raster carrega e o mapa para antes de o contorno voltar.
    emitRasterReady(0);
    expect(onCapture).not.toHaveBeenCalled();

    await act(async () => deliverOutline());
    await waitFor(() =>
      expect(mapInstances[0].triggerRepaint).toHaveBeenCalled(),
    );
    emit(0, "idle");

    await waitFor(() =>
      expect(onCapture).toHaveBeenCalledWith(
        expect.stringMatching(/^data:image\/png;base64,/),
      ),
    );
    expect(mapInstances[0].fitBounds).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it("oferece tentar de novo um mapa que a fila deu como indisponível", async () => {
    const onRetry = vi.fn();
    const onCapture = vi.fn();
    const props = {
      territory: ABADIA_DE_GOIAS,
      layerId: "anaseca",
      period: "2024-01",
      tileUrl: TILE_URL,
      onCapture,
      onRetry,
    };
    const { rerender, getByRole, queryByRole } = render(
      <ReportMapPreview {...props} />,
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

    // Enquanto a fila ainda vai tentar sozinha, o botão não aparece.
    expect(queryByRole("button", { name: "Tentar novamente" })).toBeNull();

    rerender(<ReportMapPreview {...props} active={false} />);
    getByRole("button", { name: "Tentar novamente" }).click();

    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
