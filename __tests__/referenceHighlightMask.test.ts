import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type maplibregl from "maplibre-gl";

const addProtocol = vi.hoisted(() => vi.fn());
vi.mock("maplibre-gl", () => ({ default: { addProtocol } }));

import { BRAZIL_RASTER_BOUNDS } from "@/components/Map/mapBounds";
import {
  buildHighlightMaskTiles,
  invertCoverageToMask,
  parseHighlightMaskUrl,
  syncHighlightMask,
} from "@/components/Map/referenceHighlightMask";
import {
  clearReferenceTileStore,
  fillTileTemplate,
} from "@/components/Map/referenceTileStore";

describe("invertCoverageToMask", () => {
  it("escurece onde não há território e abre onde há", () => {
    const pixels = new Uint8ClampedArray([
      // fora do território: transparente
      0, 0, 0, 0,
      // dentro: o interior opaco, na cor do grupo
      139, 87, 42, 255,
      // na borda suavizada: meio a meio
      139, 87, 42, 128,
    ]);

    invertCoverageToMask(pixels);

    expect(Array.from(pixels)).toEqual([
      0, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 127,
    ]);
  });
});

describe("endereço dos tiles da máscara", () => {
  it("vai e volta pelo protocolo próprio", () => {
    const template = buildHighlightMaskTiles("3", 7);
    const url = fillTileTemplate(template, { z: 5, x: 11, y: 16 });

    expect(parseHighlightMaskUrl(url)).toEqual({
      targetId: "3",
      generation: 7,
      tile: { z: 5, x: 11, y: 16 },
    });
    expect(parseHighlightMaskUrl("https://ee/tiles/5/11/16")).toBeNull();
  });
});

/**
 * O navegador, só no que a máscara usa: canvas com pixels de verdade e
 * `createImageBitmap`, que o jsdom não tem.
 */
class FakeBitmap {
  closed = false;
  constructor(readonly pixels: Uint8ClampedArray) {}
  close() {
    this.closed = true;
  }
}

class FakeCanvas {
  pixels = new Uint8ClampedArray(256 * 256 * 4);

  getContext() {
    return {
      fillRect: () => {
        for (let i = 0; i < this.pixels.length; i += 4)
          this.pixels[i + 3] = 255;
      },
      fillStyle: "",
      drawImage: (image: FakeBitmap) => this.pixels.set(image.pixels),
      getImageData: () => ({ data: new Uint8ClampedArray(this.pixels) }),
      putImageData: (image: { data: Uint8ClampedArray }) =>
        this.pixels.set(image.data),
    };
  }

  transferToImageBitmap() {
    return new FakeBitmap(new Uint8ClampedArray(this.pixels));
  }
}

// Um interior de território todo opaco: a máscara dele fica toda transparente.
const opaqueFill = () => {
  const pixels = new Uint8ClampedArray(256 * 256 * 4);
  for (let i = 0; i < pixels.length; i += 4) pixels[i + 3] = 255;
  return pixels;
};

function maskHandler() {
  const handler = addProtocol.mock.calls.at(-1)?.[1];
  return (url: string) =>
    handler({ url }, new AbortController()) as Promise<{
      data: FakeBitmap;
      cacheControl: string;
    }>;
}

function fakeMap() {
  return {
    getSource: vi.fn(() => ({})),
    refreshTiles: vi.fn(),
  };
}

const FILL = "https://ee/fill/{z}/{x}/{y}";
// z=6, x=23, y=34 cai no meio do Brasil; z=6, x=60, y=20 fica na Ásia.
const INSIDE_BRAZIL = { z: 6, x: 23, y: 34 };
const OUTSIDE_BRAZIL = { z: 6, x: 60, y: 20 };

describe("tiles da máscara", () => {
  let fetchTile: ReturnType<typeof vi.fn>;
  let respond: () => void;

  beforeEach(() => {
    clearReferenceTileStore();
    vi.stubGlobal("OffscreenCanvas", FakeCanvas);
    vi.stubGlobal(
      "createImageBitmap",
      async () => new FakeBitmap(opaqueFill()),
    );
    vi.stubGlobal("requestAnimationFrame", (run: () => void) => {
      run();
      return 1;
    });
    fetchTile = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          respond = () =>
            resolve({
              ok: true,
              status: 200,
              blob: async () => new Blob(["fill"]),
            } as Response);
        }),
    );
    vi.stubGlobal("fetch", fetchTile);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const urlFor = (tiles: string, tile: typeof INSIDE_BRAZIL) =>
    fillTileTemplate(tiles, tile);

  it("escurece fora do Brasil sem baixar nada", async () => {
    const map = fakeMap();
    const tiles = syncHighlightMask(
      map as unknown as maplibregl.Map,
      "mask",
      FILL,
      BRAZIL_RASTER_BOUNDS,
    );

    const tile = await maskHandler()(urlFor(tiles, OUTSIDE_BRAZIL));

    expect(fetchTile).not.toHaveBeenCalled();
    expect(tile.data.pixels[3]).toBe(255);
  });

  it("abre o território quando o interior já está no navegador", async () => {
    const map = fakeMap();
    const tiles = syncHighlightMask(
      map as unknown as maplibregl.Map,
      "mask",
      FILL,
      BRAZIL_RASTER_BOUNDS,
    );
    const pending = maskHandler()(urlFor(tiles, INSIDE_BRAZIL));
    respond();

    const tile = await pending;

    expect(fetchTile).toHaveBeenCalledWith(
      "https://ee/fill/6/23/34",
      expect.anything(),
    );
    expect(tile.data.pixels[3]).toBe(0);
  });

  it("escurece na hora e acende o tile quando o interior chega", async () => {
    vi.useFakeTimers();
    const map = fakeMap();
    const tiles = syncHighlightMask(
      map as unknown as maplibregl.Map,
      "mask",
      FILL,
      BRAZIL_RASTER_BOUNDS,
    );

    const pending = maskHandler()(urlFor(tiles, INSIDE_BRAZIL));
    await vi.advanceTimersByTimeAsync(100);
    const provisional = await pending;

    expect(provisional.data.pixels[3]).toBe(255);
    // Vence logo, para o MapLibre não guardar o escuro fora da tela.
    expect(provisional.cacheControl).toBe("max-age=1");
    expect(map.refreshTiles).not.toHaveBeenCalled();

    respond();

    await vi.waitFor(() =>
      expect(map.refreshTiles).toHaveBeenCalledWith("mask", [INSIDE_BRAZIL]),
    );
    const lit = await maskHandler()(urlFor(tiles, INSIDE_BRAZIL));
    expect(lit.data.pixels[3]).toBe(0);
    expect(fetchTile).toHaveBeenCalledTimes(1);
  });

  it("escurece tudo enquanto o endereço do grupo não chegou", async () => {
    const map = fakeMap();
    const tiles = syncHighlightMask(
      map as unknown as maplibregl.Map,
      "mask",
      undefined,
      BRAZIL_RASTER_BOUNDS,
    );

    const tile = await maskHandler()(urlFor(tiles, INSIDE_BRAZIL));

    expect(fetchTile).not.toHaveBeenCalled();
    expect(tile.data.pixels[3]).toBe(255);
  });

  it("muda o endereço da máscara quando o interior muda, e só aí", () => {
    const map = fakeMap() as unknown as maplibregl.Map;

    const first = syncHighlightMask(map, "mask", FILL, BRAZIL_RASTER_BOUNDS);
    const same = syncHighlightMask(map, "mask", FILL, BRAZIL_RASTER_BOUNDS);
    const other = syncHighlightMask(
      map,
      "mask",
      "https://ee/other-fill/{z}/{x}/{y}",
      BRAZIL_RASTER_BOUNDS,
    );

    expect(same).toBe(first);
    expect(other).not.toBe(first);
  });
});
