import { describe, expect, it, vi } from "vitest";
import type * as maplibregl from "maplibre-gl";

vi.mock("maplibre-gl", () => ({ addProtocol: vi.fn() }));

// Os quatro grupos saem dos tiles vetoriais. Aqui só as terras indígenas, para
// que os outros exercitem o caminho das imagens do Earth Engine, que continua
// valendo para um grupo tirado de `territoryVectorTiles.json`.
vi.mock("@/config/territoryVectorTiles.json", async (importOriginal) => {
  const { default: config } = await importOriginal<{
    default: Record<string, unknown>;
  }>();
  return { default: { ...config, layers: ["terras_indigenas"] } };
});

import {
  CDI_LAYER_ID,
  DIMMED_REFERENCE_OVERLAY_FILL_OPACITY,
  GEE_LAYER_ID,
  HIGHLIGHT_MASK_OPACITY,
  REF_HIGHLIGHT_MASK_LAYER_ID,
  REF_HIGHLIGHT_MASK_SOURCE_ID,
  REF_OVERLAY_LAYER_PREFIX,
  REF_OVERLAY_SOURCE_PREFIX,
  REFERENCE_OVERLAY_FILL_OPACITY,
  STATES_BORDER_LAYER_ID,
  ensureReferenceOverlayLayers,
} from "@/components/Map/mapDefinitions";
import { MUNICIPALITY_HOVER_LAYER_ID } from "@/components/Map/municipalityLayers";
import {
  VECTOR_MASK_LAYER_ID,
  VECTOR_MASK_OUTSIDE_LAYER_ID,
  VECTOR_MASK_WORLD_LAYER_ID,
  TERRITORY_INTERACTION_MIN_ZOOM,
  applyVectorHighlightMask,
  findReferenceTerritoryAtPoint,
} from "@/components/Map/territoryVectorLayers";

interface AddedLayer {
  id: string;
  source: string;
  paint?: Record<string, unknown>;
  filter?: unknown;
  beforeId?: string;
  sourceLayer?: string;
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

  constructor(readonly spec: { tiles: string[]; bounds?: unknown }) {}

  finishLoading() {
    this.tiles = this.spec.tiles;
  }

  setTiles(tiles: string[]) {
    this.spec.tiles = tiles;
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

  // A ordem de desenho, de baixo para cima, como `getLayersOrder()`.
  order: string[] = [];
  moves = 0;

  addLayer(
    layer: { id: string; source: string; "source-layer"?: string },
    beforeId?: string,
  ) {
    if (!this.styleParsed) throw new Error("Style is not done loading.");
    this.layers.set(layer.id, {
      ...layer,
      beforeId,
      sourceLayer: layer["source-layer"],
    });
    this.addedLayerOrder.push(layer.id);
    this.insert(layer.id, beforeId);
  }

  getLayersOrder() {
    return [...this.order];
  }

  moveLayer(id: string, beforeId?: string) {
    this.moves += 1;
    this.order = this.order.filter((layerId) => layerId !== id);
    this.insert(id, beforeId);
  }

  getPaintProperty(id: string, name: string) {
    return this.layers.get(id)?.paint?.[name];
  }

  getFilter(id: string) {
    return this.layers.get(id)?.filter;
  }

  setFilter(id: string, filter: unknown) {
    this.layers.get(id)!.filter = filter;
  }

  setPaintProperty(id: string, name: string, value: unknown) {
    const layer = this.layers.get(id)!;
    layer.paint = { ...layer.paint, [name]: value };
  }

  /** Uma camada que já estava no mapa, como o hover de município. */
  addExistingLayer(id: string) {
    this.layers.set(id, { id, source: id });
    this.order.push(id);
  }

  private insert(id: string, beforeId?: string) {
    const index = beforeId ? this.order.indexOf(beforeId) : -1;
    if (index < 0) this.order.push(id);
    else this.order.splice(index, 0, id);
  }

  removeSource(id: string) {
    this.sources.delete(id);
  }

  removeLayer(id: string) {
    this.layers.delete(id);
    this.order = this.order.filter((layerId) => layerId !== id);
  }

  asMapLibre() {
    return this as unknown as maplibregl.Map;
  }
}

const sourceIdOf = (overlayId: string) =>
  `${REF_OVERLAY_SOURCE_PREFIX}${overlayId}`;
const layerIdOf = (overlayId: string) =>
  `${REF_OVERLAY_LAYER_PREFIX}${overlayId}`;
const fillLayerOfRaster = (overlayId: string) => `${layerIdOf(overlayId)}-fill`;

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
          "unidades_conservacao",
          { outline: "https://tiles.example/uc/{z}/{x}/{y}" },
        ],
      ]),
    );

    expect(applied).toBe(true);
    expect(map.getLayer(layerIdOf("unidades_conservacao"))).toBeDefined();
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
      outline: "https://tiles.example/uc-outline/{z}/{x}/{y}",
      fill: "https://tiles.example/uc-fill/{z}/{x}/{y}",
    };
    const fillLayerId = `${layerIdOf("unidades_conservacao")}-fill`;

    it("desbota só o interior conforme o zoom, deixando o contorno intacto", () => {
      const map = new FakeMapLibreMap();

      ensureReferenceOverlayLayers(
        map.asMapLibre(),
        new Map([["unidades_conservacao", urls]]),
      );

      expect(map.getLayer(fillLayerId)?.paint).toEqual({
        "raster-opacity": REFERENCE_OVERLAY_FILL_OPACITY,
      });
      expect(map.getLayer(layerIdOf("unidades_conservacao"))?.paint).toEqual(
        {},
      );
    });

    it("desenha o contorno por cima do interior do mesmo território", () => {
      const map = new FakeMapLibreMap();
      map.layers.set(MUNICIPALITY_HOVER_LAYER_ID, {
        id: MUNICIPALITY_HOVER_LAYER_ID,
        source: "municipalities",
      });

      ensureReferenceOverlayLayers(
        map.asMapLibre(),
        new Map([["unidades_conservacao", urls]]),
      );

      // As duas entram logo abaixo da mesma âncora: a que entra depois fica em cima.
      expect(map.addedLayerOrder).toEqual([
        fillLayerId,
        layerIdOf("unidades_conservacao"),
      ]);
      expect(map.getLayer(fillLayerId)?.beforeId).toBe(
        MUNICIPALITY_HOVER_LAYER_ID,
      );
    });

    it("remove o interior junto com o contorno ao desligar o território", () => {
      const map = new FakeMapLibreMap();
      ensureReferenceOverlayLayers(
        map.asMapLibre(),
        new Map([["unidades_conservacao", urls]]),
      );

      ensureReferenceOverlayLayers(map.asMapLibre(), new Map());

      expect(map.sources.size).toBe(0);
      expect(map.layers.size).toBe(0);
    });
  });

  describe("destaque de um grupo", () => {
    const urlsOf = (overlayId: string) => ({
      outline: `https://tiles.example/${overlayId}-outline/{z}/{x}/{y}`,
      fill: `https://tiles.example/${overlayId}-fill/{z}/{x}/{y}`,
    });
    const twoGroups = new Map([
      ["quilombolas", urlsOf("quilombolas")],
      ["unidades_conservacao", urlsOf("unidades_conservacao")],
    ]);
    const fillLayerOf = (overlayId: string) => `${layerIdOf(overlayId)}-fill`;

    function mapWithAnchor() {
      const map = new FakeMapLibreMap();
      map.addExistingLayer(GEE_LAYER_ID);
      map.addExistingLayer(MUNICIPALITY_HOVER_LAYER_ID);
      return map;
    }

    it("escurece por cima dos outros grupos e por baixo do grupo destacado", () => {
      const map = mapWithAnchor();

      ensureReferenceOverlayLayers(map.asMapLibre(), twoGroups, "quilombolas");

      expect(map.getLayersOrder()).toEqual([
        GEE_LAYER_ID,
        fillLayerOf("unidades_conservacao"),
        layerIdOf("unidades_conservacao"),
        REF_HIGHLIGHT_MASK_LAYER_ID,
        fillLayerOf("quilombolas"),
        layerIdOf("quilombolas"),
        MUNICIPALITY_HOVER_LAYER_ID,
      ]);
      expect(map.getLayer(REF_HIGHLIGHT_MASK_LAYER_ID)?.paint).toMatchObject({
        "raster-opacity": HIGHLIGHT_MASK_OPACITY,
        "raster-fade-duration": 0,
      });
    });

    it("escurece também fora do Brasil: a máscara não tem limite", () => {
      const map = mapWithAnchor();

      ensureReferenceOverlayLayers(map.asMapLibre(), twoGroups, "quilombolas");

      const mask = map.getSource(REF_HIGHLIGHT_MASK_SOURCE_ID);
      expect(mask?.spec.bounds).toBeUndefined();
      expect(mask?.spec.tiles[0]).toMatch(/^sap-highlight-mask:\/\//);
    });

    it("apaga os outros grupos ligados sem escondê-los", () => {
      const map = mapWithAnchor();

      ensureReferenceOverlayLayers(map.asMapLibre(), twoGroups, "quilombolas");

      expect(map.getLayer(fillLayerOf("unidades_conservacao"))?.paint).toEqual({
        "raster-opacity": DIMMED_REFERENCE_OVERLAY_FILL_OPACITY,
      });
      expect(
        map.getLayer(layerIdOf("unidades_conservacao"))?.paint?.[
          "raster-opacity"
        ],
      ).toBeLessThan(1);
      expect(map.getLayer(fillLayerOf("quilombolas"))?.paint).toEqual({
        "raster-opacity": REFERENCE_OVERLAY_FILL_OPACITY,
      });
    });

    it("tirar o destaque remove a máscara e devolve o brilho dos outros grupos", () => {
      const map = mapWithAnchor();
      ensureReferenceOverlayLayers(map.asMapLibre(), twoGroups, "quilombolas");

      ensureReferenceOverlayLayers(map.asMapLibre(), twoGroups, null);

      expect(map.getSource(REF_HIGHLIGHT_MASK_SOURCE_ID)).toBeUndefined();
      expect(map.getLayer(REF_HIGHLIGHT_MASK_LAYER_ID)).toBeUndefined();
      expect(
        map.getPaintProperty(
          fillLayerOf("unidades_conservacao"),
          "raster-opacity",
        ),
      ).toEqual(REFERENCE_OVERLAY_FILL_OPACITY);
      expect(
        map.getPaintProperty(
          layerIdOf("unidades_conservacao"),
          "raster-opacity",
        ),
      ).toBe(1);
    });

    it("trocar de grupo reaproveita a máscara e só troca os tiles dela", () => {
      const map = mapWithAnchor();
      ensureReferenceOverlayLayers(map.asMapLibre(), twoGroups, "quilombolas");
      const firstTiles = map.getSource(REF_HIGHLIGHT_MASK_SOURCE_ID)?.spec
        .tiles[0];
      const createdBefore = map.createdSources;

      ensureReferenceOverlayLayers(
        map.asMapLibre(),
        twoGroups,
        "unidades_conservacao",
      );

      expect(map.createdSources).toBe(createdBefore);
      expect(
        map.getSource(REF_HIGHLIGHT_MASK_SOURCE_ID)?.spec.tiles[0],
      ).not.toBe(firstTiles);
      expect(map.getLayersOrder().slice(-4)).toEqual([
        REF_HIGHLIGHT_MASK_LAYER_ID,
        fillLayerOf("unidades_conservacao"),
        layerIdOf("unidades_conservacao"),
        MUNICIPALITY_HOVER_LAYER_ID,
      ]);
    });

    it("escurece na hora mesmo antes de o endereço do grupo chegar", () => {
      const map = mapWithAnchor();

      ensureReferenceOverlayLayers(
        map.asMapLibre(),
        new Map([["quilombolas", urlsOf("quilombolas")]]),
        "assentamentos",
      );

      expect(map.getLayer(REF_HIGHLIGHT_MASK_LAYER_ID)).toBeDefined();
      expect(map.getLayersOrder().slice(-2)).toEqual([
        REF_HIGHLIGHT_MASK_LAYER_ID,
        MUNICIPALITY_HOVER_LAYER_ID,
      ]);
    });

    it("põe por baixo da máscara um grupo ligado depois do destaque", () => {
      const map = mapWithAnchor();
      ensureReferenceOverlayLayers(
        map.asMapLibre(),
        new Map([["quilombolas", urlsOf("quilombolas")]]),
        "quilombolas",
      );

      ensureReferenceOverlayLayers(map.asMapLibre(), twoGroups, "quilombolas");

      const order = map.getLayersOrder();
      expect(order.indexOf(layerIdOf("unidades_conservacao"))).toBeLessThan(
        order.indexOf(REF_HIGHLIGHT_MASK_LAYER_ID),
      );
    });

    // Cada `moveLayer` dispara `styledata`, que chama a sincronização de novo:
    // mover sem precisar faria as duas se chamarem sem parar.
    it("não reordena nem repinta quando nada mudou", () => {
      const map = mapWithAnchor();
      ensureReferenceOverlayLayers(map.asMapLibre(), twoGroups, "quilombolas");
      const moves = map.moves;
      const tiles = map.getSource(REF_HIGHLIGHT_MASK_SOURCE_ID)?.spec.tiles[0];

      ensureReferenceOverlayLayers(map.asMapLibre(), twoGroups, "quilombolas");

      expect(map.moves).toBe(moves);
      expect(map.getSource(REF_HIGHLIGHT_MASK_SOURCE_ID)?.spec.tiles[0]).toBe(
        tiles,
      );
    });
  });

  describe("terras indígenas desenhadas dos tiles vetoriais", () => {
    const TI = "terras_indigenas";
    const TI_URLS = {
      outline:
        "http://localhost/api/tiles/{z}/{x}/{y}?tileset=territories-terras_indigenas",
    };
    const ti = (part: string) => `ref-vector-${TI}-${part}`;
    const quilombolaUrls = {
      outline: "https://tiles.example/q-outline/{z}/{x}/{y}",
      fill: "https://tiles.example/q-fill/{z}/{x}/{y}",
    };

    function mapWithAnchor() {
      const map = new FakeMapLibreMap();
      map.addExistingLayer(GEE_LAYER_ID);
      map.addExistingLayer(MUNICIPALITY_HOVER_LAYER_ID);
      return map;
    }

    it("desenha interior e contorno abaixo do hover, e o nome por cima de tudo", () => {
      const map = mapWithAnchor();

      ensureReferenceOverlayLayers(map.asMapLibre(), new Map([[TI, TI_URLS]]));

      expect(map.getLayersOrder()).toEqual([
        GEE_LAYER_ID,
        ti("fill"),
        ti("halo"),
        ti("outline"),
        ti("selected"),
        MUNICIPALITY_HOVER_LAYER_ID,
        ti("label"),
      ]);
      expect(map.getLayer(ti("label"))?.sourceLayer).toBe(`${TI}_rotulos`);
      // Cada grupo lê o arquivo dele.
      expect(map.getSource(`ref-vector-src-${TI}`)?.spec.tiles[0]).toMatch(
        /tileset=territories-terras_indigenas$/,
      );
      expect(map.getLayer(ti("fill"))?.paint?.["fill-opacity"]).toEqual(
        REFERENCE_OVERLAY_FILL_OPACITY,
      );
      // Nenhuma imagem do Earth Engine para as terras indígenas.
      expect(map.getLayer(layerIdOf(TI))).toBeUndefined();
    });

    it("engrossa o contorno só do território marcado no grupo dele", () => {
      const map = mapWithAnchor();
      const groups = new Map<string, typeof TI_URLS>([[TI, TI_URLS]]);

      ensureReferenceOverlayLayers(map.asMapLibre(), groups, null, {
        layerId: TI,
        name: "Kiriri",
        municipality: "Banzaê",
      });
      // O nome sozinho se repete: o município separa os homônimos.
      expect(map.getFilter(ti("selected"))).toEqual([
        "all",
        ["==", ["get", "name"], "Kiriri"],
        ["==", ["get", "municipio"], "Banzaê"],
      ]);

      ensureReferenceOverlayLayers(map.asMapLibre(), groups, null, {
        layerId: "quilombolas",
        name: "Kiriri",
        municipality: "Banzaê",
      });
      expect(map.getFilter(ti("selected"))).toEqual([
        "all",
        ["==", ["get", "name"], ""],
        ["==", ["get", "municipio"], ""],
      ]);
    });

    it("em destaque, escurece com a máscara dos tiles e o resto do mundo", () => {
      const map = mapWithAnchor();

      ensureReferenceOverlayLayers(
        map.asMapLibre(),
        new Map<string, { outline: string; fill?: string }>([
          ["quilombolas", quilombolaUrls],
          [TI, TI_URLS],
        ]),
        TI,
      );

      expect(map.getLayer(REF_HIGHLIGHT_MASK_LAYER_ID)).toBeUndefined();
      expect(map.getLayer(VECTOR_MASK_LAYER_ID)?.sourceLayer).toBe(
        `${TI}_mascara`,
      );
      expect(map.getLayersOrder()).toEqual([
        GEE_LAYER_ID,
        fillLayerOfRaster("quilombolas"),
        layerIdOf("quilombolas"),
        VECTOR_MASK_OUTSIDE_LAYER_ID,
        VECTOR_MASK_WORLD_LAYER_ID,
        VECTOR_MASK_LAYER_ID,
        ti("fill"),
        ti("halo"),
        ti("outline"),
        ti("selected"),
        MUNICIPALITY_HOVER_LAYER_ID,
        ti("label"),
      ]);
      expect(map.getLayer(VECTOR_MASK_LAYER_ID)?.paint).toMatchObject({
        "fill-opacity": HIGHLIGHT_MASK_OPACITY,
        "fill-antialias": false,
      });
    });

    it("trocar o grupo em destaque troca a máscara e a fonte dela", () => {
      const map = mapWithAnchor();
      const anchor = MUNICIPALITY_HOVER_LAYER_ID;

      applyVectorHighlightMask(map.asMapLibre(), TI, 0.6, anchor);
      applyVectorHighlightMask(
        map.asMapLibre(),
        "unidades_conservacao",
        0.6,
        anchor,
      );

      expect(map.getLayer(VECTOR_MASK_LAYER_ID)).toMatchObject({
        source: "ref-vector-mask-src-unidades_conservacao",
        sourceLayer: "unidades_conservacao_mascara",
      });
      expect(map.getLayer(VECTOR_MASK_WORLD_LAYER_ID)?.sourceLayer).toBe(
        "unidades_conservacao_mascara_fora",
      );
      expect(map.getSource(`ref-vector-mask-src-${TI}`)).toBeUndefined();
      expect(
        map.getSource("ref-vector-mask-src-unidades_conservacao")?.spec
          .tiles[0],
      ).toMatch(/tileset=territories-unidades_conservacao$/);
    });

    it("com outro grupo em destaque, apaga as terras indígenas e o nome delas", () => {
      const map = mapWithAnchor();

      ensureReferenceOverlayLayers(
        map.asMapLibre(),
        new Map<string, { outline: string; fill?: string }>([
          ["quilombolas", quilombolaUrls],
          [TI, TI_URLS],
        ]),
        "quilombolas",
      );

      expect(map.getLayer(VECTOR_MASK_LAYER_ID)).toBeUndefined();
      expect(map.getLayer(REF_HIGHLIGHT_MASK_LAYER_ID)).toBeDefined();
      expect(map.getPaintProperty(ti("fill"), "fill-opacity")).toEqual(
        DIMMED_REFERENCE_OVERLAY_FILL_OPACITY,
      );
      expect(map.getPaintProperty(ti("outline"), "line-opacity")).toBeLessThan(
        1,
      );
      expect(map.getPaintProperty(ti("label"), "text-opacity")).toBe(0);
    });

    it("desligar o grupo tira as camadas, a fonte e a máscara", () => {
      const map = mapWithAnchor();
      ensureReferenceOverlayLayers(
        map.asMapLibre(),
        new Map([[TI, TI_URLS]]),
        TI,
      );

      ensureReferenceOverlayLayers(map.asMapLibre(), new Map(), null);

      expect(map.getLayersOrder()).toEqual([
        GEE_LAYER_ID,
        MUNICIPALITY_HOVER_LAYER_ID,
      ]);
      expect(map.sources.size).toBe(0);
    });

    it("não reordena nem repinta quando nada mudou", () => {
      const map = mapWithAnchor();
      const groups = new Map([[TI, TI_URLS]]);
      ensureReferenceOverlayLayers(map.asMapLibre(), groups, TI);
      const moves = map.moves;
      const created = map.createdSources;

      ensureReferenceOverlayLayers(map.asMapLibre(), groups, TI);

      expect(map.moves).toBe(moves);
      expect(map.createdSources).toBe(created);
    });
  });
});

describe("findReferenceTerritoryAtPoint", () => {
  const mapAtZoom = (zoom: number) =>
    ({
      getZoom: () => zoom,
      getLayer: () => ({}),
      queryRenderedFeatures: () => [
        {
          sourceLayer: "terras_indigenas",
          properties: { name: "Yanomami", municipio: "Alto Alegre" },
        },
      ],
    }) as unknown as maplibregl.Map;

  it("de longe não pega o território: o clique segue para o estado", () => {
    expect(
      findReferenceTerritoryAtPoint(
        mapAtZoom(TERRITORY_INTERACTION_MIN_ZOOM - 0.1),
        [0, 0],
      ),
    ).toBeNull();
  });

  it("de perto pega o território sob o ponto", () => {
    expect(
      findReferenceTerritoryAtPoint(
        mapAtZoom(TERRITORY_INTERACTION_MIN_ZOOM),
        [0, 0],
      ),
    ).toEqual({
      layerId: "terras_indigenas",
      name: "Yanomami",
      municipality: "Alto Alegre",
    });
  });
});
