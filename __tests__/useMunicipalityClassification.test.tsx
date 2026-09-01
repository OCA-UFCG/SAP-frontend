import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type maplibregl from "maplibre-gl";
import { useMunicipalityClassification } from "@/components/Map/useMunicipalityClassification";
import {
  CLASSIFICATION_LAYER_ID,
  CLASSIFICATION_OVERVIEW_LAYER_ID,
  CLASSIFICATION_OVERVIEW_SOURCE_ID,
  buildClassificationFillOpacity,
  type MunicipalityClassification,
} from "@/components/Map/classificationLayers";
import { MUNICIPALITY_SOURCE_ID } from "@/components/Map/municipalityLayers";

/**
 * Mapa mínimo: registra as escritas que custam caro (feature-state) e as que
 * custam barato (paint), para o teste poder distinguir as duas.
 */
class FakeClassificationMap {
  readonly styledataHandlers: Array<() => void> = [];

  setFeatureState = vi.fn();
  removeFeatureState = vi.fn();
  setPaintProperty = vi.fn();
  addLayer = vi.fn();
  addSource = vi.fn();

  getSource = (id: string) =>
    id === MUNICIPALITY_SOURCE_ID || id === CLASSIFICATION_OVERVIEW_SOURCE_ID
      ? {}
      : undefined;

  getLayer = (id: string) =>
    id === CLASSIFICATION_LAYER_ID || id === CLASSIFICATION_OVERVIEW_LAYER_ID
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

const CLASSIFICATION: MunicipalityClassification = {
  classificationByCode: { "2500106": 4, "2600054": 2 },
  excludedCodes: ["2900108"],
};

const renderClassification = (map: FakeClassificationMap, opacity: number) => {
  // A ref precisa ser estável entre renders, como a que o Map de verdade passa:
  // recriá-la a cada render sozinha já invalidaria o efeito da classificação.
  const mapRef = { current: map as unknown as maplibregl.Map };

  return renderHook(
    ({ fillOpacity }) =>
      useMunicipalityClassification(
        mapRef,
        CLASSIFICATION,
        null,
        1,
        fillOpacity,
      ),
    { initialProps: { fillOpacity: opacity } },
  );
};

let map: FakeClassificationMap;

beforeEach(() => {
  map = new FakeClassificationMap();
});

describe("useMunicipalityClassification", () => {
  it("writes the classification and the chosen opacity on mount", () => {
    renderClassification(map, 0.85);

    expect(map.setFeatureState).toHaveBeenCalled();
    expect(map.setPaintProperty).toHaveBeenCalledWith(
      CLASSIFICATION_LAYER_ID,
      "fill-opacity",
      buildClassificationFillOpacity(0.85),
    );
  });

  // Regressão: a opacidade estava nas dependências do efeito da classificação,
  // então cada parada da barra reescrevia o feature-state de todo município da
  // análise — mais de 11 mil escritas numa análise nacional — para mudar duas
  // propriedades de pintura.
  it("repaints without rewriting the classification when only the slider moves", () => {
    const { rerender } = renderClassification(map, 0.85);

    map.setFeatureState.mockClear();
    map.removeFeatureState.mockClear();
    map.setPaintProperty.mockClear();

    rerender({ fillOpacity: 0.4 });

    expect(map.setFeatureState).not.toHaveBeenCalled();
    expect(map.removeFeatureState).not.toHaveBeenCalled();
    expect(map.setPaintProperty).toHaveBeenCalledWith(
      CLASSIFICATION_LAYER_ID,
      "fill-opacity",
      buildClassificationFillOpacity(0.4),
    );
  });

  // O reload de estilo devolve o paint declarado na criação da camada, então o
  // reapply precisa usar o valor atual da barra, não o que valia na montagem.
  it("reapplies the current slider value after a style reload", () => {
    const { rerender } = renderClassification(map, 0.85);

    rerender({ fillOpacity: 0.4 });
    map.setPaintProperty.mockClear();

    map.fireStyledata();

    expect(map.setPaintProperty).toHaveBeenCalledWith(
      CLASSIFICATION_LAYER_ID,
      "fill-opacity",
      buildClassificationFillOpacity(0.4),
    );
  });
});
