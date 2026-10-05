import { describe, expect, it } from "vitest";
import type maplibregl from "maplibre-gl";

import {
  CDI_LAYER_ID,
  GEE_LAYER_ID,
  REF_OVERLAY_LAYER_PREFIX,
  REF_OVERLAY_SOURCE_PREFIX,
  REFERENCE_OVERLAY_FILL_OPACITY,
  STATES_BORDER_LAYER_ID,
  ensureReferenceOverlayLayers,
} from "@/components/Map/mapDefinitions";
import { MUNICIPALITY_HOVER_LAYER_ID } from "@/components/Map/municipalityLayers";

interface AddedLayer {
  id: string;
  source: string;
  paint?: Record<string, unknown>;
  beforeId?: string;
}

/**
 * Dublê do MapLibre com o comportamento que importa aqui: `addSource`/`addLayer`
 * recusam a escrita enquanto o estilo não terminou de ser parseado, exatamente
 * como o `Style._checkLoaded()` do MapLibre.
 */
/**
 * Como a `RasterTileSource`: `tiles` só é preenchido quando a source termina de
 * carregar, enquanto `serialize()` devolve a spec desde o início.
 */
class FakeRasterSource {
  tiles: string[] | undefined;

  constructor(private readonly spec: { tiles: string[] }) {}

  finishLoading() {
    this.tiles = this.spec.tiles;
  }

  serialize() {
    return { ...this.spec };
  }
}

class FakeMapLibreMap {
  sources = new Map<string, FakeRasterSource>();
  createdSources = 0;
  layers = new Map<string, AddedLayer>();
  addedLayerOrder: string[] = [];
  styleParsed = true;
  // O MapLibre devolve false aqui enquanto QUALQUER source ainda busca tiles.
  styleLoadedFlag = true;

  isStyleLoaded() {
    return this.styleLoadedFlag;
  }

  getSource(id: string) {
    return this.sources.get(id);
  }

  getLayer(id: string) {
    return this.layers.get(id);
  }

  addSource(id: string, source: { tiles: string[] }) {
    if (!this.styleParsed) throw new Error("Style is not done loading.");
    this.sources.set(id, new FakeRasterSource(source));
    this.createdSources += 1;
  }

  addLayer(layer: { id: string; source: string }, beforeId?: string) {
    if (!this.styleParsed) throw new Error("Style is not done loading.");
    this.layers.set(layer.id, { ...layer, beforeId });
    this.addedLayerOrder.push(layer.id);
  }

  removeSource(id: string) {
    this.sources.delete(id);
  }

  removeLayer(id: string) {
    this.layers.delete(id);
  }

  asMapLibre() {
    return this as unknown as maplibregl.Map;
  }
}

const sourceIdOf = (overlayId: string) =>
  `${REF_OVERLAY_SOURCE_PREFIX}${overlayId}`;
const layerIdOf = (overlayId: string) =>
  `${REF_OVERLAY_LAYER_PREFIX}${overlayId}`;

describe("ensureReferenceOverlayLayers", () => {
  it("adds a raster source and layer for each active overlay", () => {
    const map = new FakeMapLibreMap();

    const applied = ensureReferenceOverlayLayers(
      map.asMapLibre(),
      new Map([
        [
          "quilombolas",
          { outline: "https://tiles.example/quilombolas/{z}/{x}/{y}" },
        ],
        [
          "assentamentos",
          { outline: "https://tiles.example/assentamentos/{z}/{x}/{y}" },
        ],
      ]),
    );

    expect(applied).toBe(true);
    expect(map.getSource(sourceIdOf("quilombolas"))?.serialize().tiles).toEqual(
      ["https://tiles.example/quilombolas/{z}/{x}/{y}"],
    );
    expect(map.getLayer(layerIdOf("assentamentos"))?.source).toBe(
      sourceIdOf("assentamentos"),
    );
  });

  it("removes the source and layer of an overlay that left the active set", () => {
    const map = new FakeMapLibreMap();
    ensureReferenceOverlayLayers(
      map.asMapLibre(),
      new Map([
        ["quilombolas", { outline: "https://tiles.example/a/{z}/{x}/{y}" }],
      ]),
    );

    ensureReferenceOverlayLayers(map.asMapLibre(), new Map());

    expect(map.getSource(sourceIdOf("quilombolas"))).toBeUndefined();
    expect(map.getLayer(layerIdOf("quilombolas"))).toBeUndefined();
  });

  // Regressão: clicar repetidamente nos territórios fazia todos pararem de
  // aparecer. `map.isStyleLoaded()` retorna false enquanto qualquer source ainda
  // busca tiles, então o guard antigo bloqueava a adição justamente durante os
  // cliques seguidos, e nada voltava a desenhar as camadas.
  it("adds overlays while tiles are still loading and isStyleLoaded() is false", () => {
    const map = new FakeMapLibreMap();
    map.styleLoadedFlag = false;

    const applied = ensureReferenceOverlayLayers(
      map.asMapLibre(),
      new Map([
        [
          "terras_indigenas",
          { outline: "https://tiles.example/ti/{z}/{x}/{y}" },
        ],
      ]),
    );

    expect(applied).toBe(true);
    expect(map.getLayer(layerIdOf("terras_indigenas"))).toBeDefined();
  });

  it("reports a failed write so the caller can retry when the style is parsed", () => {
    const map = new FakeMapLibreMap();
    map.styleParsed = false;

    const applied = ensureReferenceOverlayLayers(
      map.asMapLibre(),
      new Map([
        ["quilombolas", { outline: "https://tiles.example/a/{z}/{x}/{y}" }],
      ]),
    );

    expect(applied).toBe(false);
    expect(map.getLayer(layerIdOf("quilombolas"))).toBeUndefined();

    map.styleParsed = true;
    expect(
      ensureReferenceOverlayLayers(
        map.asMapLibre(),
        new Map([
          ["quilombolas", { outline: "https://tiles.example/a/{z}/{x}/{y}" }],
        ]),
      ),
    ).toBe(true);
    expect(map.getLayer(layerIdOf("quilombolas"))).toBeDefined();
  });

  it("recreates the source when the tile URL changes", () => {
    const map = new FakeMapLibreMap();
    ensureReferenceOverlayLayers(
      map.asMapLibre(),
      new Map([
        ["quilombolas", { outline: "https://tiles.example/old/{z}/{x}/{y}" }],
      ]),
    );

    ensureReferenceOverlayLayers(
      map.asMapLibre(),
      new Map([
        ["quilombolas", { outline: "https://tiles.example/new/{z}/{x}/{y}" }],
      ]),
    );

    expect(map.getSource(sourceIdOf("quilombolas"))?.serialize().tiles).toEqual(
      ["https://tiles.example/new/{z}/{x}/{y}"],
    );
    expect(map.getLayer(layerIdOf("quilombolas"))).toBeDefined();
  });

  it("puts overlays above the analysis layers, below hover and borders", () => {
    const map = new FakeMapLibreMap();
    map.layers.set(GEE_LAYER_ID, { id: GEE_LAYER_ID, source: "gee" });
    map.layers.set(CDI_LAYER_ID, { id: CDI_LAYER_ID, source: "cdi" });
    map.layers.set(MUNICIPALITY_HOVER_LAYER_ID, {
      id: MUNICIPALITY_HOVER_LAYER_ID,
      source: "municipalities",
    });

    ensureReferenceOverlayLayers(
      map.asMapLibre(),
      new Map([
        [
          "unidades_conservacao",
          { outline: "https://tiles.example/uc/{z}/{x}/{y}" },
        ],
      ]),
    );

    expect(map.getLayer(layerIdOf("unidades_conservacao"))?.beforeId).toBe(
      MUNICIPALITY_HOVER_LAYER_ID,
    );
  });

  it("falls back to the state borders while the municipality layers are absent", () => {
    const map = new FakeMapLibreMap();
    map.layers.set(GEE_LAYER_ID, { id: GEE_LAYER_ID, source: "gee" });
    map.layers.set(STATES_BORDER_LAYER_ID, {
      id: STATES_BORDER_LAYER_ID,
      source: "states",
    });

    ensureReferenceOverlayLayers(
      map.asMapLibre(),
      new Map([
        ["quilombolas", { outline: "https://tiles.example/q/{z}/{x}/{y}" }],
      ]),
    );

    expect(map.getLayer(layerIdOf("quilombolas"))?.beforeId).toBe(
      STATES_BORDER_LAYER_ID,
    );
  });

  it("is idempotent when called repeatedly with the same overlays", () => {
    const map = new FakeMapLibreMap();
    const tileUrls = new Map([
      ["quilombolas", { outline: "https://tiles.example/a/{z}/{x}/{y}" }],
    ]);

    ensureReferenceOverlayLayers(map.asMapLibre(), tileUrls);
    ensureReferenceOverlayLayers(map.asMapLibre(), tileUrls);
    ensureReferenceOverlayLayers(map.asMapLibre(), tileUrls);

    expect(map.sources.size).toBe(1);
    expect(map.layers.size).toBe(1);
  });

  // Regressão: o carregamento do interior dispara outra sincronização enquanto o
  // contorno ainda carrega. Recriar a source nesse momento a fazia recomeçar do
  // zero a cada vez, e o contorno nunca aparecia.
  it("keeps a source that is still loading when the URL did not change", () => {
    const map = new FakeMapLibreMap();
    const tileUrls = new Map([
      ["quilombolas", { outline: "https://tiles.example/a/{z}/{x}/{y}" }],
    ]);

    ensureReferenceOverlayLayers(map.asMapLibre(), tileUrls);
    ensureReferenceOverlayLayers(map.asMapLibre(), tileUrls);

    expect(map.createdSources).toBe(1);
    map.getSource(sourceIdOf("quilombolas"))?.finishLoading();
    ensureReferenceOverlayLayers(map.asMapLibre(), tileUrls);
    expect(map.createdSources).toBe(1);
  });

  describe("interior e contorno em camadas separadas", () => {
    const urls = {
      outline: "https://tiles.example/ti-outline/{z}/{x}/{y}",
      fill: "https://tiles.example/ti-fill/{z}/{x}/{y}",
    };
    const fillLayerId = `${layerIdOf("terras_indigenas")}-fill`;

    it("desbota só o interior conforme o zoom, deixando o contorno intacto", () => {
      const map = new FakeMapLibreMap();

      ensureReferenceOverlayLayers(
        map.asMapLibre(),
        new Map([["terras_indigenas", urls]]),
      );

      expect(map.getLayer(fillLayerId)?.paint).toEqual({
        "raster-opacity": REFERENCE_OVERLAY_FILL_OPACITY,
      });
      expect(map.getLayer(layerIdOf("terras_indigenas"))?.paint).toEqual({});
    });

    it("desenha o contorno por cima do interior do mesmo território", () => {
      const map = new FakeMapLibreMap();
      map.layers.set(MUNICIPALITY_HOVER_LAYER_ID, {
        id: MUNICIPALITY_HOVER_LAYER_ID,
        source: "municipalities",
      });

      ensureReferenceOverlayLayers(
        map.asMapLibre(),
        new Map([["terras_indigenas", urls]]),
      );

      // As duas entram logo abaixo da mesma âncora: a que entra depois fica em cima.
      expect(map.addedLayerOrder).toEqual([
        fillLayerId,
        layerIdOf("terras_indigenas"),
      ]);
      expect(map.getLayer(fillLayerId)?.beforeId).toBe(
        MUNICIPALITY_HOVER_LAYER_ID,
      );
    });

    it("remove o interior junto com o contorno ao desligar o território", () => {
      const map = new FakeMapLibreMap();
      ensureReferenceOverlayLayers(
        map.asMapLibre(),
        new Map([["terras_indigenas", urls]]),
      );

      ensureReferenceOverlayLayers(map.asMapLibre(), new Map());

      expect(map.sources.size).toBe(0);
      expect(map.layers.size).toBe(0);
    });
  });
});
