import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isCategoricalMapVisualization } from "@/app/api/ee/mapVisualization";
import type { CompactMapVisualizationConfig } from "@/utils/analysis";

/**
 * Camadas reais do catálogo, pelo que o `mapVisualization` delas publica hoje.
 * As quatro primeiras são as que o teste de tiles mostrou quebradas no zoom
 * afastado; as demais são as que não devem pagar o custo da escala nativa.
 */
const LAYERS: Record<string, CompactMapVisualizationConfig> = {
  degradacaoDaTerra: {
    sourceType: "image",
    band: "b1",
    sourceBand: "b1",
    min: 1,
    max: 6,
    legend: [1, 2, 3, 4, 5, 6].map((pixelLimit) => ({ pixelLimit })),
  },
  coberturaDaTerra: {
    sourceType: "imageCollection",
    band: "b1",
    sourceBand: "b1",
    min: 1,
    max: 14,
    legend: [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14].map((pixelLimit) => ({
      pixelLimit,
    })),
  },
  ods1531: {
    sourceType: "image",
    band: "b1",
    sourceBand: "b1",
    min: 9,
    max: 11,
    legend: [9, 10, 11].map((pixelLimit) => ({ pixelLimit })),
  },
  carbonoOrganicoDoSolo: {
    sourceType: "image",
    min: 1,
    max: 6,
    legend: [1, 2, 3, 4, 5, 6].map((pixelLimit) => ({ pixelLimit })),
  },
  producaoPrimariaBruta: {
    sourceType: "imageCollection",
    band: "Gpp",
    sourceBand: "Gpp",
    min: 1,
    max: 6,
    thresholds: [700, 1300, 1800, 2400, 2900],
    legend: [1, 2, 3, 4, 5, 6].map((pixelLimit) => ({ pixelLimit })),
  },
  previsaoAnomaliaPrecipitacao: {
    sourceType: "imageCollection",
    band: "b1",
    sourceBand: "b1",
    min: 0,
    max: 5,
    thresholds: [-50, -20, 20, 50, 100],
    legend: [0, 1, 2, 3, 4, 5].map((pixelLimit) => ({ pixelLimit })),
  },
  pobrezaTotal: {
    sourceType: "featureCollection",
    property: "2025",
    min: 1,
    max: 5,
    thresholds: [10, 25, 40, 60],
    legend: [{}, {}, {}, {}, {}],
  },
};

describe("camadas que precisam da escala nativa do asset", () => {
  it("reconhece as quatro camadas de classes discretas do catálogo", () => {
    expect(isCategoricalMapVisualization(LAYERS.degradacaoDaTerra)).toBe(true);
    expect(isCategoricalMapVisualization(LAYERS.coberturaDaTerra)).toBe(true);
    expect(isCategoricalMapVisualization(LAYERS.ods1531)).toBe(true);
    expect(isCategoricalMapVisualization(LAYERS.carbonoOrganicoDoSolo)).toBe(
      true,
    );
  });

  it("deixa de fora quem classifica um dado contínuo por faixas", () => {
    // A média da pirâmide é legítima aqui, e a Produção Primária Bruta paga 11x
    // o tempo de renderização por um desvio medido de 0,8 ponto percentual.
    expect(isCategoricalMapVisualization(LAYERS.producaoPrimariaBruta)).toBe(
      false,
    );
    expect(
      isCategoricalMapVisualization(LAYERS.previsaoAnomaliaPrecipitacao),
    ).toBe(false);
  });

  it("deixa de fora camadas vetoriais, que não têm pirâmide", () => {
    expect(isCategoricalMapVisualization(LAYERS.pobrezaTotal)).toBe(false);
  });

  it("exige uma legenda de valores inteiros para afirmar que são classes", () => {
    expect(isCategoricalMapVisualization({ legend: [] })).toBe(false);
    expect(isCategoricalMapVisualization({})).toBe(false);
    expect(
      isCategoricalMapVisualization({
        legend: [{ pixelLimit: 0.5 }, { pixelLimit: 1.5 }],
      }),
    ).toBe(false);
  });
});
