import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  remap: vi.fn(),
  select: vi.fn(),
  where: vi.fn(),
  round: vi.fn(),
  int: vi.fn(),
}));

/** Imagem falsa que registra a cadeia de operações aplicada a ela. */
function fakeImage(label: string) {
  const image = {
    label,
    select: (band: string) => {
      mocks.select(band);
      return fakeImage(`${label}.select(${band})`);
    },
    remap: (from: number[], to: number[]) => {
      mocks.remap(from, to);
      return fakeImage(`${label}.remap`);
    },
    round: () => {
      mocks.round();
      return fakeImage(`${label}.round`);
    },
    int: () => {
      mocks.int();
      return fakeImage(`${label}.int`);
    },
    where: () => {
      mocks.where();
      return fakeImage(`${label}.where`);
    },
    rename: () => fakeImage(`${label}.rename`),
    updateMask: () => fakeImage(`${label}.updateMask`),
    mask: () => image,
    gt: () => image,
    gte: () => image,
    lte: () => image,
    and: () => image,
  };
  return image;
}

vi.mock("@google/earthengine", () => ({
  default: {
    Image: (value: unknown) => fakeImage(`Image(${String(value)})`),
    FeatureCollection: () => ({ filter: () => ({}) }),
    Filter: { eq: () => ({}) },
  },
}));

vi.mock("@/infrastructure/earth-engine/client", () => ({
  initializeGee: vi.fn(),
  evaluateGeeObject: vi.fn(),
}));

vi.mock("@/app/api/ee/spatialBoundaries", () => ({
  getSpatialBoundaryFeatures: vi.fn(() => []),
}));

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(),
}));

import { applyMapVisualization } from "@/app/api/ee/services";

const GAPPED_INDEXES = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14];

function legendFor(indexes: number[]) {
  return indexes.map((pixelLimit) => ({
    id: `classe-${pixelLimit}`,
    label: `Classe ${pixelLimit}`,
    color: `#${String(pixelLimit).padStart(2, "0")}0000`,
    pixelLimit,
  }));
}

function visualizationFor(indexes: number[], overrides = {}) {
  const legend = legendFor(indexes);
  return {
    min: Math.min(...indexes),
    max: Math.max(...indexes),
    palette: legend.map((entry) => entry.color),
    legend,
    band: "b1",
    ...overrides,
  };
}

describe("applyMapVisualization com classes esparsas", () => {
  beforeEach(() => vi.clearAllMocks());

  // Sem isso o Earth Engine espalha 12 cores por 14 valores e cada classe
  // recebe a cor da vizinha — um mapa silenciosamente errado.
  it("remapeia a imagem quando as classes têm lacunas", () => {
    const result = applyMapVisualization(
      fakeImage("raster"),
      visualizationFor(GAPPED_INDEXES),
      [],
      0,
      0,
    );

    expect(mocks.remap).toHaveBeenCalledWith(
      GAPPED_INDEXES,
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    );
    expect(result.visParams).toEqual({
      min: 1,
      max: 12,
      palette: visualizationFor(GAPPED_INDEXES).palette,
    });
  });

  // Regressão: "Cobertura da Terra | IBGE s" aparecia só com zoom. Longe, a
  // pirâmide do raster float entrega médias (4,3 entre as classes 2 e 6) e o
  // `remap` mascarava tudo que não fosse um valor exato da lista.
  it("arredonda para inteiro antes de remapear, senão a camada some no zoom afastado", () => {
    applyMapVisualization(
      fakeImage("raster"),
      visualizationFor(GAPPED_INDEXES),
      [],
      0,
      0,
    );

    expect(mocks.round).toHaveBeenCalled();
    expect(mocks.int).toHaveBeenCalled();
    expect(mocks.round.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.remap.mock.invocationCallOrder[0],
    );
    expect(mocks.int.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.remap.mock.invocationCallOrder[0],
    );
  });

  it("seleciona a banda antes de remapear, porque remap só aceita uma banda", () => {
    applyMapVisualization(
      fakeImage("raster"),
      visualizationFor(GAPPED_INDEXES),
      [],
      0,
      0,
    );

    expect(mocks.select).toHaveBeenCalledWith("b1");
    expect(mocks.select.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.remap.mock.invocationCallOrder[0],
    );
  });

  it("não toca na imagem de uma camada com classes contíguas", () => {
    const result = applyMapVisualization(
      fakeImage("raster"),
      visualizationFor([2, 3, 4, 5]),
      [],
      0,
      0,
    );

    expect(mocks.remap).not.toHaveBeenCalled();
    expect(result.visParams).toEqual({
      min: 2,
      max: 5,
      palette: ["#020000", "#030000", "#040000", "#050000"],
    });
  });

  it("não remapeia em cima de uma classificação por limites", () => {
    applyMapVisualization(
      fakeImage("raster"),
      visualizationFor(GAPPED_INDEXES, {
        thresholds: [10, 20, 30],
        sourceBand: "raw",
      }),
      [],
      0,
      0,
    );

    expect(mocks.where).toHaveBeenCalled();
    expect(mocks.remap).not.toHaveBeenCalled();
  });
});
