import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Os quatro grupos saem dos tiles vetoriais. Aqui só as terras indígenas, para
// que os outros exercitem o caminho das imagens do Earth Engine, que continua
// valendo para um grupo tirado de `territoryVectorTiles.json`.
vi.mock("@/config/territoryVectorTiles.json", async (importOriginal) => {
  const { default: config } = await importOriginal<{
    default: Record<string, unknown>;
  }>();
  return { default: { ...config, layers: ["terras_indigenas"] } };
});

const getGeeMapUrl = vi.hoisted(() => vi.fn());
vi.mock("@/infrastructure/earth-engine/client", () => ({
  initializeGee: vi.fn().mockResolvedValue(undefined),
  getGeeMapUrl,
}));

interface FakeStyledImage {
  blend: (top: FakeStyledImage) => FakeStyledImage;
}
const fakeStyledImage = (): FakeStyledImage => ({
  blend: () => fakeStyledImage(),
});
vi.mock("@google/earthengine", () => ({
  default: {
    FeatureCollection: (assetId: string) => ({
      style: () => ({ ...fakeStyledImage(), assetId }),
    }),
  },
}));

import { CACHE_TTL_MS, getCachedUrl, removeCacheUrl } from "@/app/api/ee/cache";
import {
  REFERENCE_LAYER_ASSETS,
  REFERENCE_LAYER_REFRESH_MS,
  refreshReferenceLayerUrls,
  resolveReferenceLayerUrls,
} from "@/app/api/ee/referenceLayers";

// As terras indígenas saem dos tiles vetoriais: o servidor não prepara mais
// o endereço delas no Earth Engine.
const LAYER_IDS = Object.keys(REFERENCE_LAYER_ASSETS).filter(
  (layerId) => layerId !== "terras_indigenas",
);

beforeEach(() => {
  let next = 0;
  getGeeMapUrl.mockReset();
  getGeeMapUrl.mockImplementation(
    async () => `https://ee/maps/${++next}/tiles/{z}/{x}/{y}`,
  );
  for (const layerId of Object.keys(REFERENCE_LAYER_ASSETS)) {
    removeCacheUrl(`ref-overlay-v3:${layerId}:outline`);
    removeCacheUrl(`ref-overlay-v3:${layerId}:fill`);
  }
});

afterEach(() => {
  vi.useRealTimers();
});

describe("endereços dos territórios prontos no servidor", () => {
  it("prepara o interior e o contorno dos grupos do Earth Engine", async () => {
    await refreshReferenceLayerUrls();

    expect(getGeeMapUrl).toHaveBeenCalledTimes(LAYER_IDS.length * 2);
    for (const layerId of LAYER_IDS) {
      expect(getCachedUrl(`ref-overlay-v3:${layerId}:outline`)).toBeDefined();
      expect(getCachedUrl(`ref-overlay-v3:${layerId}:fill`)).toBeDefined();
    }
    expect(
      getCachedUrl("ref-overlay-v3:terras_indigenas:fill"),
    ).toBeUndefined();
  });

  it("depois de preparar, ligar um grupo não vai ao Earth Engine", async () => {
    await refreshReferenceLayerUrls();
    getGeeMapUrl.mockClear();

    const urls = await resolveReferenceLayerUrls("unidades_conservacao");

    expect(getGeeMapUrl).not.toHaveBeenCalled();
    expect(urls.url).not.toBe(urls.fillUrl);
  });

  it("um grupo que falha não impede os outros", async () => {
    getGeeMapUrl.mockRejectedValueOnce(new Error("asset indisponível"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await refreshReferenceLayerUrls();

    const ready = LAYER_IDS.flatMap((layerId) => [
      getCachedUrl(`ref-overlay-v3:${layerId}:fill`),
      getCachedUrl(`ref-overlay-v3:${layerId}:outline`),
    ]).filter(Boolean);
    expect(ready).toHaveLength(LAYER_IDS.length * 2 - 1);
  });

  it("renova antes de o endereço guardado vencer", () => {
    expect(REFERENCE_LAYER_REFRESH_MS).toBeLessThan(CACHE_TTL_MS);
  });

  it("a renovação troca o endereço guardado por um novo", async () => {
    await refreshReferenceLayerUrls();
    const before = getCachedUrl("ref-overlay-v3:quilombolas:fill");

    await refreshReferenceLayerUrls();

    expect(getCachedUrl("ref-overlay-v3:quilombolas:fill")).not.toBe(before);
  });
});
