import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  listAssets: vi.fn(),
  initializeGee: vi.fn(),
}));

vi.mock("@google/earthengine", () => ({
  default: {
    data: { listAssets: mocks.listAssets },
    FeatureCollection: () => ({ filter: () => ({}) }),
    Filter: { eq: () => ({}) },
  },
}));

vi.mock("@/infrastructure/earth-engine/client", () => ({
  initializeGee: mocks.initializeGee,
  evaluateGeeObject: vi.fn(),
}));

vi.mock("@/app/api/ee/spatialBoundaries", () => ({
  getSpatialBoundaryFeatures: vi.fn(() => []),
}));

vi.mock("@/repositories/platform/panelLayerRepository", () => ({
  getPanelLayers: vi.fn(),
}));

import { listEarthEngineAssets } from "@/app/api/ee/services";

interface Page {
  assets?: Array<Record<string, unknown>>;
  nextPageToken?: string;
}

/** Responde páginas na ordem, registrando o pageToken que cada chamada enviou. */
function respondWithPages(pages: Page[]) {
  const requestedTokens: Array<string | undefined> = [];
  let call = 0;
  mocks.listAssets.mockImplementation(
    (
      _parent: string,
      params: { pageToken?: string },
      callback: (page: Page) => void,
    ) => {
      requestedTokens.push(params.pageToken);
      callback(pages[call++] ?? {});
    },
  );
  return requestedTokens;
}

function table(id: string) {
  return { id, type: "TABLE", updateTime: "2026-08-27T20:15:35.398639Z" };
}

describe("listEarthEngineAssets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initializeGee.mockResolvedValue(undefined);
  });

  // Ler só a primeira página fazia o catálogo publicar um índice com anos
  // faltando e sem nenhum erro: a validação confirmava os anos que sobraram.
  it("segue o nextPageToken até a última página", async () => {
    const requestedTokens = respondWithPages([
      { assets: [table("t_1990"), table("t_1991")], nextPageToken: "p2" },
      { assets: [table("t_1992")], nextPageToken: "p3" },
      { assets: [table("t_1993")] },
    ]);

    const assets = await listEarthEngineAssets("projects/x/assets/pasta");

    expect(assets.map((asset) => asset.id)).toEqual([
      "t_1990",
      "t_1991",
      "t_1992",
      "t_1993",
    ]);
    expect(requestedTokens).toEqual([undefined, "p2", "p3"]);
  });

  it("faz uma única chamada quando a pasta cabe em uma página", async () => {
    respondWithPages([{ assets: [table("t_2024")] }]);

    await listEarthEngineAssets("projects/x/assets/pasta");

    expect(mocks.listAssets).toHaveBeenCalledTimes(1);
  });

  it("preserva o tipo e o updateTime que a listagem já devolve", async () => {
    respondWithPages([{ assets: [table("t_2024")] }]);

    await expect(
      listEarthEngineAssets("projects/x/assets/pasta"),
    ).resolves.toEqual([
      {
        id: "t_2024",
        type: "TABLE",
        updateTime: "2026-08-27T20:15:35.398639Z",
      },
    ]);
  });

  // Um servidor que devolvesse sempre o mesmo token viraria laço infinito
  // dentro de uma requisição HTTP, sem nenhum sinal do que travou.
  it("para de paginar em vez de girar para sempre num token que não avança", async () => {
    mocks.listAssets.mockImplementation(
      (
        _parent: string,
        _params: { pageToken?: string },
        callback: (page: Page) => void,
      ) => callback({ assets: [table("t_2024")], nextPageToken: "sempre" }),
    );

    const assets = await listEarthEngineAssets("projects/x/assets/pasta");

    expect(mocks.listAssets).toHaveBeenCalledTimes(100);
    expect(assets).toHaveLength(100);
  });

  it("propaga o erro do Earth Engine em vez de devolver lista vazia", async () => {
    mocks.listAssets.mockImplementation(
      (
        _parent: string,
        _params: unknown,
        callback: (page: undefined, error: unknown) => void,
      ) => callback(undefined, new Error("permissão negada")),
    );

    await expect(
      listEarthEngineAssets("projects/x/assets/pasta"),
    ).rejects.toThrow(/permissão negada/u);
  });
});
