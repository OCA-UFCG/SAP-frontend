import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BRAZIL_RASTER_BOUNDS } from "@/components/Map/mapBounds";
import {
  PREFETCH_CONCURRENCY,
  clearReferenceTileStore,
  loadReferenceTile,
  peekReferenceTile,
  prefetchReferenceOverlayViewport,
  prefetchReferenceTiles,
  rasterTileZoom,
  tileIntersectsBounds,
  tilesCoveringBounds,
} from "@/components/Map/referenceTileStore";

/** Um Earth Engine que só responde quando o teste manda. */
class FakeTileServer {
  requested: string[] = [];
  private pending = new Map<string, () => void>();

  readonly fetch = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    this.requested.push(url);
    return new Promise<Response>((resolve) => {
      this.pending.set(url, () =>
        resolve({
          ok: true,
          status: 200,
          blob: async () => new Blob([url]),
        } as Response),
      );
    });
  });

  get inFlight() {
    return this.pending.size;
  }

  async respond(url: string) {
    const resolve = this.pending.get(url);
    this.pending.delete(url);
    resolve?.();
    await vi.waitFor(() => expect(peekReferenceTile(url)).toBeDefined());
  }
}

let server: FakeTileServer;

beforeEach(() => {
  clearReferenceTileStore();
  server = new FakeTileServer();
  vi.stubGlobal("fetch", server.fetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadReferenceTile", () => {
  it("pede um endereço uma vez só, mesmo com dois pedidos ao mesmo tempo", async () => {
    const first = loadReferenceTile("https://ee/tiles/5/11/16");
    const second = loadReferenceTile("https://ee/tiles/5/11/16");

    await server.respond("https://ee/tiles/5/11/16");

    expect(await first).toBe(await second);
    expect(server.requested).toEqual(["https://ee/tiles/5/11/16"]);
  });

  it("devolve da memória o tile que já chegou, sem ir à rede", async () => {
    const request = loadReferenceTile("https://ee/tiles/5/11/16");
    await server.respond("https://ee/tiles/5/11/16");
    await request;

    await loadReferenceTile("https://ee/tiles/5/11/16");

    expect(server.requested).toHaveLength(1);
  });

  it("manda o mesmo Accept do MapLibre, para dividir o cache do navegador", () => {
    void loadReferenceTile("https://ee/tiles/5/11/16");

    expect(server.fetch).toHaveBeenCalledWith("https://ee/tiles/5/11/16", {
      headers: { Accept: "image/webp,*/*" },
    });
  });
});

describe("prefetchReferenceTiles", () => {
  const urls = Array.from(
    { length: PREFETCH_CONCURRENCY + 3 },
    (_, i) => `https://ee/tiles/5/${i}/16`,
  );

  it("não passa do limite de downloads ao mesmo tempo", () => {
    prefetchReferenceTiles(urls);

    expect(server.inFlight).toBe(PREFETCH_CONCURRENCY);
    expect(server.requested).toEqual(urls.slice(0, PREFETCH_CONCURRENCY));
  });

  it("começa o próximo da fila quando um termina", async () => {
    prefetchReferenceTiles(urls);

    await server.respond(urls[0]);

    await vi.waitFor(() =>
      expect(server.requested).toContain(urls[PREFETCH_CONCURRENCY]),
    );
    expect(server.inFlight).toBe(PREFETCH_CONCURRENCY);
  });

  it("não pede de novo o que já está em memória, em voo ou na fila", async () => {
    const request = loadReferenceTile(urls[0]);
    await server.respond(urls[0]);
    await request;
    void loadReferenceTile(urls[1]);

    prefetchReferenceTiles([urls[0], urls[1], urls[2], urls[2]]);

    expect(server.requested).toEqual([urls[0], urls[1], urls[2]]);
  });
});

describe("tiles da área à vista", () => {
  it("usa o zoom de tile que o MapLibre usa numa fonte de 256 px", () => {
    expect(rasterTileZoom(3.6)).toBe(5);
    expect(rasterTileZoom(3.4)).toBe(4);
    expect(rasterTileZoom(30)).toBe(22);
  });

  it("reconhece o tile que cobre parte do retângulo e o que fica fora", () => {
    // z=2, x=1, y=2: de -90 a 0 de longitude, de 0 a -66,5 de latitude.
    expect(
      tileIntersectsBounds({ z: 2, x: 1, y: 2 }, BRAZIL_RASTER_BOUNDS),
    ).toBe(true);
    // z=2, x=3, y=1: de 90 a 180 de longitude, no hemisfério norte.
    expect(
      tileIntersectsBounds({ z: 2, x: 3, y: 1 }, BRAZIL_RASTER_BOUNDS),
    ).toBe(false);
  });

  it("cobre só a parte da tela que cai dentro do Brasil", () => {
    const tiles = tilesCoveringBounds(
      [-120, -60, 20, 30],
      4,
      BRAZIL_RASTER_BOUNDS,
    );

    expect(tiles.length).toBeGreaterThan(0);
    for (const tile of tiles) {
      expect(tileIntersectsBounds(tile, BRAZIL_RASTER_BOUNDS)).toBe(true);
    }
  });

  it("começa pelo centro da tela", () => {
    const tiles = tilesCoveringBounds(
      [-60, -20, -40, -5],
      6,
      BRAZIL_RASTER_BOUNDS,
    );

    // O centro (-50, -12,5) cai no tile x=23, y=34 em z=6.
    expect(tiles[0]).toEqual({ z: 6, x: 23, y: 34 });
  });

  it("não devolve nada quando a tela está toda fora do Brasil", () => {
    expect(
      tilesCoveringBounds([100, 10, 140, 40], 5, BRAZIL_RASTER_BOUNDS),
    ).toEqual([]);
  });

  it("baixa os interiores de todos os grupos antes dos contornos", () => {
    prefetchReferenceOverlayViewport(
      [
        {
          outline: "https://ee/a-outline/{z}/{x}/{y}",
          fill: "https://ee/a-fill/{z}/{x}/{y}",
        },
        {
          outline: "https://ee/b-outline/{z}/{x}/{y}",
          fill: "https://ee/b-fill/{z}/{x}/{y}",
        },
      ],
      [-50.5, -12.5, -49.5, -11.5],
      5,
      BRAZIL_RASTER_BOUNDS,
    );

    expect(server.requested.map((url) => url.split("/")[3])).toEqual([
      "a-fill",
      "b-fill",
      "a-outline",
      "b-outline",
    ]);
  });
});
