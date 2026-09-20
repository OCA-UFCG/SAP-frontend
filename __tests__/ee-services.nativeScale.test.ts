import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const spies = vi.hoisted(() => ({
  reproject: vi.fn(),
  conditional: vi.fn(),
}));

/**
 * Imagem falsa que registra a cadeia aplicada a ela. Só precisa responder às
 * operações que `getEarthEngineUrl` encadeia; cada uma devolve uma nova imagem
 * rotulada, para o teste poder afirmar em que ponto o `reproject` entrou.
 */
function fakeImage(label: string) {
  const image = {
    label,
    select: (band: unknown) => fakeImage(`${label}.select(${String(band)})`),
    projection: () => ({
      label: `${label}.projection`,
      nominalScale: () => ({ lte: (limit: number) => `scale<=${limit}` }),
    }),
    reproject: (args: { crs: unknown; scale: unknown }) => {
      spies.reproject(args);
      return fakeImage(`${label}.reproject`);
    },
    selfMask: () => fakeImage(`${label}.selfMask`),
    clipToCollection: () => fakeImage(`${label}.clip`),
    remap: () => fakeImage(`${label}.remap`),
    round: () => fakeImage(`${label}.round`),
    int: () => fakeImage(`${label}.int`),
    where: () => image,
    rename: () => fakeImage(`${label}.rename`),
    updateMask: () => fakeImage(`${label}.updateMask`),
    mask: () => image,
    gte: () => image,
    first: () => fakeImage(`${label}.first`),
    mosaic: () => fakeImage(`${label}.mosaic`),
    setDefaultProjection: () => fakeImage(`${label}.setDefaultProjection`),
    filter: () => image,
    filterDate: () => image,
    // `selectLastBand`, o caminho das camadas legadas sem `mapVisualization`.
    bandNames: () => ({
      get: () => "última",
      size: () => ({ subtract: () => 0 }),
    }),
    getMapId: (_visParams: unknown, callback: (mapId: unknown) => void) =>
      callback({ urlFormat: `https://tiles.test/${label}` }),
  };
  return image;
}

vi.mock("@google/earthengine", () => ({
  default: {
    Image: (value: unknown) =>
      // `ee.Image(...)` também embrulha o resultado de `ee.Algorithms.If`, que
      // aqui já é uma imagem falsa.
      typeof value === "object" && value !== null && "label" in value
        ? (value as ReturnType<typeof fakeImage>)
        : fakeImage(`Image(${String(value)})`),
    ImageCollection: (value: unknown) => fakeImage(`Collection(${value})`),
    FeatureCollection: () => ({ filter: () => ({}) }),
    Feature: () => ({}),
    Geometry: () => ({}),
    Filter: { eq: () => ({}), or: () => ({}) },
    Algorithms: {
      If: (condition: unknown, whenTrue: unknown) => {
        spies.conditional(condition);
        return whenTrue;
      },
    },
    data: {
      // A camada legada, sem `mapVisualization`, ainda pergunta o tipo do asset.
      getAsset: (
        _assetId: string,
        onSuccess: (asset: { type: string }) => void,
      ) => queueMicrotask(() => onSuccess({ type: "Image" })),
    },
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

import { getEarthEngineUrl } from "@/app/api/ee/services";

function legendFor(pixelValues: number[]) {
  return pixelValues.map((pixelLimit) => ({
    id: `classe-${pixelLimit}`,
    label: `Classe ${pixelLimit}`,
    color: "#112233",
    pixelLimit,
  }));
}

/** O Índice de Degradação da Terra, que sai errado sem a escala nativa. */
const DEGRADACAO_DA_TERRA = {
  sourceType: "image" as const,
  band: "b1",
  sourceBand: "b1",
  min: 1,
  max: 6,
  palette: Array.from({ length: 6 }, () => "#112233"),
  legend: legendFor([1, 2, 3, 4, 5, 6]),
};

/** A Produção Primária Bruta, contínua e classificada por faixas. */
const PRODUCAO_PRIMARIA_BRUTA = {
  ...DEGRADACAO_DA_TERRA,
  sourceBand: "Gpp",
  band: "Gpp",
  thresholds: [700, 1300, 1800, 2400, 2900],
};

describe("escala nativa no pipeline do /api/ee", () => {
  beforeEach(() => vi.clearAllMocks());

  // Regressão: em z5 no semiárido, 67,7% dos pixels do Índice de Degradação da
  // Terra saíam numa cor fora da legenda, porque a pirâmide MEAN do asset
  // entrega a média entre duas classes. Com a escala nativa, 0%.
  it("prende a imagem à escala nativa quando a camada desenha classes", async () => {
    await getEarthEngineUrl("asset/degradacao", [], 1, 6, {
      mapVisualization: DEGRADACAO_DA_TERRA,
    });

    expect(spies.reproject).toHaveBeenCalledTimes(1);
    const [args] = spies.reproject.mock.calls[0];
    expect(args.crs).toMatchObject({ label: expect.stringContaining("b1") });
  });

  // O teste de escala tem de ficar dentro da expressão do Earth Engine: lê-lo
  // no cliente custaria um round trip de ~1 s em cada miss de cache.
  it("decide pela escala do asset sem ida extra ao Earth Engine", async () => {
    await getEarthEngineUrl("asset/degradacao", [], 1, 6, {
      mapVisualization: DEGRADACAO_DA_TERRA,
    });

    expect(spies.conditional).toHaveBeenCalledWith("scale<=1000");
  });

  it("não mexe em camadas que classificam um dado contínuo por faixas", async () => {
    await getEarthEngineUrl("asset/gpp", [], 1, 6, {
      mapVisualization: PRODUCAO_PRIMARIA_BRUTA,
    });

    expect(spies.reproject).not.toHaveBeenCalled();
    expect(spies.conditional).not.toHaveBeenCalled();
  });

  it("não mexe em camadas sem mapVisualization", async () => {
    await getEarthEngineUrl("asset/legado", [], 0, 5, {});

    expect(spies.reproject).not.toHaveBeenCalled();
  });
});
