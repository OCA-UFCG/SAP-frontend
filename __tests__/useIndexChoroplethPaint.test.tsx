import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type maplibregl from "maplibre-gl";
import { useIndexChoroplethPaint } from "@/components/Map/useIndexChoroplethPaint";
import {
  INDEX_CHOROPLETH_LAYER_ID,
  INDEX_CHOROPLETH_OVERVIEW_LAYER_ID,
  buildChoroplethFillOpacity,
} from "@/components/Map/indexChoroplethLayers";
import { CLASSIFICATION_OVERVIEW_SOURCE_ID } from "@/components/Map/classificationLayers";
import { MUNICIPALITY_SOURCE_ID } from "@/components/Map/municipalityLayers";
import type { IndexChoropleth } from "@/components/PlatformMap/useIndexChoroplethValues";

/**
 * Mapa mínimo: registra as escritas que custam caro (feature-state) e as que
 * custam barato (paint), para o teste poder distinguir as duas.
 */
class FakeChoroplethPaintMap {
  readonly styledataHandlers: Array<() => void> = [];

  setFeatureState = vi.fn();
  removeFeatureState = vi.fn();
  setPaintProperty = vi.fn();
  addLayer = vi.fn();
  addSource = vi.fn();
  removeLayer = vi.fn();

  getSource = (id: string) =>
    id === MUNICIPALITY_SOURCE_ID || id === CLASSIFICATION_OVERVIEW_SOURCE_ID
      ? {}
      : undefined;

  getLayer = (id: string) =>
    id === INDEX_CHOROPLETH_LAYER_ID ||
    id === INDEX_CHOROPLETH_OVERVIEW_LAYER_ID
      ? { id }
      : undefined;

  on = (event: string, handler: () => void) => {
    if (event === "styledata") this.styledataHandlers.push(handler);
  };

  off = vi.fn();

  fireStyledata() {
    for (const handler of this.styledataHandlers) handler();
  }
}

const PALETTE = ["#FEE5D9", "#FC9272", "#DE2D26"];

const CHOROPLETH: IndexChoropleth = {
  palette: PALETTE,
  classByCode: { "2507507": 0, "2504009": 2 },
  overviewGeoJson: null,
};

const renderChoropleth = (map: FakeChoroplethPaintMap, opacity: number) => {
  // A ref precisa ser estável entre renders, como a que o Map de verdade passa.
  const mapRef = { current: map as unknown as maplibregl.Map };

  return renderHook(
    ({ fillOpacity }) =>
      useIndexChoroplethPaint(mapRef, CHOROPLETH, 1, fillOpacity),
    { initialProps: { fillOpacity: opacity } },
  );
};

let map: FakeChoroplethPaintMap;

beforeEach(() => {
  map = new FakeChoroplethPaintMap();
});

describe("useIndexChoroplethPaint", () => {
  it("writes the class of each municipality and the chosen opacity on mount", () => {
    renderChoropleth(map, 0.85);

    expect(map.setFeatureState).toHaveBeenCalled();
    expect(map.setPaintProperty).toHaveBeenCalledWith(
      INDEX_CHOROPLETH_LAYER_ID,
      "fill-opacity",
      buildChoroplethFillOpacity(PALETTE, 0.85),
    );
  });

  // Regressão: a opacidade estava nas dependências do efeito que grava as
  // faixas, então cada parada da barra limpava e reescrevia o feature-state dos
  // 5.571 municípios nas duas sources — da ordem de 22 mil escritas por passo,
  // e a barra anda de 0,05 em 0,05. É o mesmo cuidado que
  // `useMunicipalityClassification` já tomava.
  it("repaints without rewriting the classes when only the slider moves", () => {
    const { rerender } = renderChoropleth(map, 0.85);

    map.setFeatureState.mockClear();
    map.removeFeatureState.mockClear();
    map.setPaintProperty.mockClear();

    rerender({ fillOpacity: 0.4 });

    expect(map.setFeatureState).not.toHaveBeenCalled();
    expect(map.removeFeatureState).not.toHaveBeenCalled();
    expect(map.setPaintProperty).toHaveBeenCalledWith(
      INDEX_CHOROPLETH_LAYER_ID,
      "fill-opacity",
      buildChoroplethFillOpacity(PALETTE, 0.4),
    );
  });

  // O reload de estilo devolve o paint declarado na criação da camada, então o
  // reapply precisa usar o valor atual da barra, e não o que valia na montagem.
  it("reapplies the current slider value after a style reload", () => {
    const { rerender } = renderChoropleth(map, 0.85);

    rerender({ fillOpacity: 0.4 });
    map.setPaintProperty.mockClear();

    map.fireStyledata();

    expect(map.setPaintProperty).toHaveBeenCalledWith(
      INDEX_CHOROPLETH_LAYER_ID,
      "fill-opacity",
      buildChoroplethFillOpacity(PALETTE, 0.4),
    );
  });
});
