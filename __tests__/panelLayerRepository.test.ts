import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/contentful/client", () => ({
  getContent: vi.fn(),
}));

import { getContent } from "@/infrastructure/contentful/client";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";

const mockedGetContent = vi.mocked(getContent);

function buildPanelLayerResponse(items: unknown[]) {
  return {
    panelLayerCollection: {
      items,
    },
  };
}

function buildMunicipalAnalysisResponse(items: unknown[]) {
  return {
    municipalAnalysisCollection: {
      items,
    },
  };
}

describe("panelLayerRepository", () => {
  beforeEach(() => {
    mockedGetContent.mockReset();
  });

  it("ignores null panel layer items from Contentful", async () => {
    mockedGetContent.mockResolvedValueOnce(
      buildPanelLayerResponse([
        null,
        {
          sys: { id: "sys-1" },
          id: "layer-1",
          name: "Layer 1",
          description: "Layer 1",
          category: "cat",
          previewMap: { url: "https://example.com/map.png" },
          imageData: {},
          years: [],
        },
      ]),
    );
    mockedGetContent.mockResolvedValueOnce(
      buildMunicipalAnalysisResponse([]),
    );

    const layers = await getPanelLayers();

    expect(layers).toHaveLength(1);
    expect(layers[0]?.id).toBe("layer-1");
    expect(layers[0]?.category).toBe("cat");
  });

  it("preserves category values and sorts by panel position", async () => {
    mockedGetContent.mockResolvedValueOnce(
      buildPanelLayerResponse([
        {
          sys: { id: "sys-2" },
          id: "layer-2",
          name: "Layer 2",
          description: "Layer 2",
          category: "Categoria Livre",
          panelPosition: 2,
          previewMap: { url: "https://example.com/map-2.png" },
          imageData: {},
        },
        {
          sys: { id: "sys-1" },
          id: "layer-1",
          name: "Layer 1",
          description: "Layer 1",
          category: "Dados Climáticos",
          panelPosition: 1,
          previewMap: { url: "https://example.com/map-1.png" },
          imageData: {},
        },
      ]),
    );
    mockedGetContent.mockResolvedValueOnce(
      buildMunicipalAnalysisResponse([]),
    );

    const layers = await getPanelLayers();

    expect(layers.map((layer) => layer.id)).toEqual(["layer-1", "layer-2"]);
    expect(layers.map((layer) => layer.category)).toEqual([
      "Dados Climáticos",
      "Categoria Livre",
    ]);
  });

  it("merges municipal analysis data from Contentful into the matching panel layer", async () => {
    mockedGetContent.mockImplementation(async (query: string) => {
      if (query.includes("municipalAnalysisCollection")) {
        return buildMunicipalAnalysisResponse([
          {
            sys: { id: "municipal-1" },
            panelLayerId: "layer-1",
            imageData: {
              locations: {
                "2914802": "Itabuna - BA",
              },
              templates: {
                municipality:
                  "No município de {name}, predomina a classe {label} com {value}% da área analisada.",
              },
              years: {
                "2026-02": {
                  valuesScale: 1,
                  values: {
                    "2914802": [80, 20],
                  },
                },
              },
            },
          },
        ]);
      }

      return buildPanelLayerResponse([
        {
          sys: { id: "sys-1" },
          id: "layer-1",
          name: "Layer 1",
          description: "Layer 1",
          category: "Dados Climáticos",
          panelPosition: 1,
          previewMap: { url: "https://example.com/map-1.png" },
          imageData: {
            schemaVersion: 1,
            type: "territorial-compact",
            defaultYear: "2026-02",
            classes: [
              { id: "a", label: "Classe A", color: "#111111" },
              { id: "b", label: "Classe B", color: "#222222" },
            ],
            locations: {
              br: "Brasil",
              ba: "Bahia",
            },
            years: {
              "2026-02": {
                imageId: "img-2026-02",
                valuesScale: 10,
                values: {
                  br: [450, 550],
                  ba: [350, 650],
                },
              },
            },
          },
        },
      ]);
    });

    const [layer] = await getPanelLayers();
    const imageData = layer?.imageData as {
      locations: Record<string, string>;
      years: Record<string, { valuesScale?: number; values: Record<string, number[]> }>;
      templates?: { municipality?: string };
    };

    expect(imageData.locations["2914802"]).toBe("Itabuna - BA");
    expect(imageData.years["2026-02"]?.valuesScale).toBe(10);
    expect(imageData.years["2026-02"]?.values["2914802"]).toEqual([800, 200]);
    expect(imageData.templates?.municipality).toContain("No município de");
  });
});
