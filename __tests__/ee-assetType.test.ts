import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const eeMocks = vi.hoisted(() => ({
  getAsset: vi.fn(),
}));

vi.mock("@google/earthengine", () => ({
  default: { data: { getAsset: eeMocks.getAsset } },
}));

import {
  clearGeeAssetTypeCache,
  mapVisualizationAssetType,
  normalizeGeeAssetType,
  resolveGeeAssetType,
} from "@/app/api/ee/assetType";

/** `ee.data.getAsset` falso que responde no próximo tick, como o SDK real. */
class FakeAssetDirectory {
  constructor(private readonly typesById: Record<string, string>) {}

  respond = (
    assetId: string,
    onSuccess: (asset: { type: string }) => void,
    onError: () => void,
  ) => {
    const type = this.typesById[assetId];
    queueMicrotask(() => (type ? onSuccess({ type }) : onError()));
  };
}

describe("normalização do tipo de asset", () => {
  it("aceita todas as grafias que o Earth Engine devolve", () => {
    expect(normalizeGeeAssetType("ImageCollection")).toBe("IMAGECOLLECTION");
    expect(normalizeGeeAssetType("IMAGE_COLLECTION")).toBe("IMAGECOLLECTION");
    expect(normalizeGeeAssetType("image-collection")).toBe("IMAGECOLLECTION");
    expect(normalizeGeeAssetType(undefined)).toBe("");
  });
});

describe("tipo declarado no mapVisualization", () => {
  it("traduz cada sourceType do contrato v2", () => {
    expect(mapVisualizationAssetType({ sourceType: "image" })).toBe("IMAGE");
    expect(mapVisualizationAssetType({ sourceType: "imageCollection" })).toBe(
      "IMAGECOLLECTION",
    );
    expect(mapVisualizationAssetType({ sourceType: "featureCollection" })).toBe(
      "TABLE",
    );
  });

  it("devolve nulo quando a camada não declara sourceType", () => {
    expect(mapVisualizationAssetType({ band: "CDI" })).toBeNull();
    expect(mapVisualizationAssetType(undefined)).toBeNull();
  });
});

describe("resolução do tipo de asset", () => {
  beforeEach(() => {
    clearGeeAssetTypeCache();
    eeMocks.getAsset.mockReset();
  });

  it("não vai ao Earth Engine quando o sourceType já diz o tipo", async () => {
    await expect(
      resolveGeeAssetType("projects/x/assets/pob_total", {
        sourceType: "featureCollection",
      }),
    ).resolves.toBe("TABLE");
    expect(eeMocks.getAsset).not.toHaveBeenCalled();
  });

  it("pergunta uma vez só por asset e reaproveita a resposta", async () => {
    const directory = new FakeAssetDirectory({
      "projects/x/assets/cdi_2026_01": "Image",
    });
    eeMocks.getAsset.mockImplementation(directory.respond);

    await expect(
      resolveGeeAssetType("projects/x/assets/cdi_2026_01"),
    ).resolves.toBe("IMAGE");
    await expect(
      resolveGeeAssetType("projects/x/assets/cdi_2026_01"),
    ).resolves.toBe("IMAGE");

    expect(eeMocks.getAsset).toHaveBeenCalledTimes(1);
  });

  it("compartilha uma única ida quando vários pedidos caem no mesmo miss", async () => {
    const directory = new FakeAssetDirectory({
      "projects/x/assets/cdi_2026_01": "Image",
    });
    eeMocks.getAsset.mockImplementation(directory.respond);

    const results = await Promise.all([
      resolveGeeAssetType("projects/x/assets/cdi_2026_01"),
      resolveGeeAssetType("projects/x/assets/cdi_2026_01"),
      resolveGeeAssetType("projects/x/assets/cdi_2026_01"),
    ]);

    expect(results).toEqual(["IMAGE", "IMAGE", "IMAGE"]);
    expect(eeMocks.getAsset).toHaveBeenCalledTimes(1);
  });

  it("devolve vazio quando o asset não pode ser lido, mantendo o ramo ee.Image", async () => {
    eeMocks.getAsset.mockImplementation(new FakeAssetDirectory({}).respond);

    await expect(resolveGeeAssetType("projects/x/assets/sumiu")).resolves.toBe(
      "",
    );
  });

  it("não guarda a falha: a próxima leitura volta a perguntar", async () => {
    const failing = new FakeAssetDirectory({});
    eeMocks.getAsset.mockImplementation(failing.respond);
    await resolveGeeAssetType("projects/x/assets/instavel");

    const recovered = new FakeAssetDirectory({
      "projects/x/assets/instavel": "Table",
    });
    eeMocks.getAsset.mockImplementation(recovered.respond);

    await expect(
      resolveGeeAssetType("projects/x/assets/instavel"),
    ).resolves.toBe("TABLE");
    expect(eeMocks.getAsset).toHaveBeenCalledTimes(2);
  });

  it("volta a perguntar depois que a publicação do catálogo limpa o cache", async () => {
    const directory = new FakeAssetDirectory({
      "projects/x/assets/cdi_2026_01": "Image",
    });
    eeMocks.getAsset.mockImplementation(directory.respond);

    await resolveGeeAssetType("projects/x/assets/cdi_2026_01");
    clearGeeAssetTypeCache();
    await resolveGeeAssetType("projects/x/assets/cdi_2026_01");

    expect(eeMocks.getAsset).toHaveBeenCalledTimes(2);
  });
});
