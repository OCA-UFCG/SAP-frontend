import { beforeEach, describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";

vi.mock("@/infrastructure/contentful/client", () => ({
  getContent: vi.fn(),
}));

import { getContent } from "@/infrastructure/contentful/client";
import {
  getPanelLayers,
  getPanelLayerWithMunicipalAnalysis,
  getPanelLayerWithMunicipalAnalysisYear,
} from "@/repositories/platform/panelLayerRepository";

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

function compressImageData(imageData: unknown) {
  const rawJson = JSON.stringify(imageData);
  const compressed = gzipSync(Buffer.from(rawJson, "utf8"), { level: 9 });

  return {
    schemaVersion: 1,
    type: "territorial-compact-compressed",
    encoding: "gzip+base64",
    mediaType: "application/vnd.sedes.territorial-analysis+json",
    rawBytes: Buffer.byteLength(rawJson),
    compressedBytes: compressed.byteLength,
    data: compressed.toString("base64"),
  };
}

function buildValidImageData() {
  return {
    schemaVersion: 1,
    type: "territorial-compact",
    defaultYear: "2026",
    classes: [{ id: "a", label: "Classe A", color: "#111111" }],
    locations: { br: "Brasil" },
    years: {
      "2026": {
        imageId: "img-2026",
      },
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
          imageData: buildValidImageData(),
          years: [],
        },
      ]),
    );
    mockedGetContent.mockResolvedValueOnce(buildMunicipalAnalysisResponse([]));

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
          imageData: buildValidImageData(),
        },
        {
          sys: { id: "sys-1" },
          id: "layer-1",
          name: "Layer 1",
          description: "Layer 1",
          category: "Dados Climáticos",
          panelPosition: 1,
          previewMap: { url: "https://example.com/map-1.png" },
          imageData: buildValidImageData(),
        },
      ]),
    );
    mockedGetContent.mockResolvedValueOnce(buildMunicipalAnalysisResponse([]));

    const layers = await getPanelLayers();

    expect(layers.map((layer) => layer.id)).toEqual(["layer-1", "layer-2"]);
    expect(layers.map((layer) => layer.category)).toEqual([
      "Dados Climáticos",
      "Categoria Livre",
    ]);
  });

  it("does not fetch municipal analysis for the default panel layers request", async () => {
    mockedGetContent.mockResolvedValueOnce(
      buildPanelLayerResponse([
        {
          sys: { id: "sys-1" },
          id: "layer-1",
          name: "Layer 1",
          description: "Layer 1",
          panelPosition: 1,
          previewMap: { url: "https://example.com/map-1.png" },
          imageData: buildValidImageData(),
        },
      ]),
    );

    await getPanelLayers();

    expect(mockedGetContent).toHaveBeenCalledTimes(1);
    expect(mockedGetContent).not.toHaveBeenCalledWith(
      expect.stringContaining("municipalAnalysisCollection"),
      expect.anything(),
      expect.anything(),
    );
  });

  it("keeps panel layers with invalid runtime imageData but logs diagnostics", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockedGetContent.mockResolvedValueOnce(
      buildPanelLayerResponse([
        {
          sys: { id: "sys-1" },
          id: "layer-1",
          name: "Layer 1",
          description: "Layer 1",
          panelPosition: 1,
          previewMap: { url: "https://example.com/map-1.png" },
          imageData: { type: "territorial-compact", years: {} },
        },
      ]),
    );

    const layers = await getPanelLayers();

    expect(layers).toHaveLength(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining(
        "[panelLayerRepository] imageData inválido vindo do Contentful para panelLayer layer-1:",
      ),
    );

    warn.mockRestore();
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

    const [layer] = await getPanelLayers({ includeMunicipalAnalysis: true });
    const imageData = layer?.imageData as {
      locations: Record<string, string>;
      years: Record<
        string,
        { valuesScale?: number; values: Record<string, number[]> }
      >;
      templates?: { municipality?: string };
    };

    expect(imageData.locations["2914802"]).toBe("Itabuna - BA");
    expect(imageData.years["2026-02"]?.valuesScale).toBe(10);
    expect(imageData.years["2026-02"]?.values["2914802"]).toEqual([800, 200]);
    expect(imageData.templates?.municipality).toContain("No município de");
  });

  it("merges multiple municipal analysis entries for the same panel layer", async () => {
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
              years: {
                "2026-01": {
                  valuesScale: 1,
                  values: {
                    "2914802": [70, 30],
                  },
                },
              },
            },
          },
          {
            sys: { id: "municipal-2" },
            panelLayerId: "layer-1",
            imageData: {
              locations: {
                "2927408": "Salvador - BA",
              },
              years: {
                "2026-02": {
                  valuesScale: 1,
                  values: {
                    "2927408": [40, 60],
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
            defaultYear: "2026-01",
            classes: [
              { id: "a", label: "Classe A", color: "#111111" },
              { id: "b", label: "Classe B", color: "#222222" },
            ],
            years: {
              "2026-01": {
                imageId: "img-2026-01",
                values: {},
              },
              "2026-02": {
                imageId: "img-2026-02",
                values: {},
              },
            },
          },
        },
      ]);
    });

    const [layer] = await getPanelLayers({ includeMunicipalAnalysis: true });
    const imageData = layer?.imageData as {
      locations: Record<string, string>;
      years: Record<string, { values: Record<string, number[]> }>;
    };

    expect(imageData.locations["2914802"]).toBe("Itabuna - BA");
    expect(imageData.locations["2927408"]).toBe("Salvador - BA");
    expect(imageData.years["2026-01"]?.values["2914802"]).toEqual([70, 30]);
    expect(imageData.years["2026-02"]?.values["2927408"]).toEqual([40, 60]);
  });

  it("decodes compressed municipal analysis imageData before merging", async () => {
    mockedGetContent.mockImplementation(async (query: string) => {
      if (query.includes("municipalAnalysisCollection")) {
        return buildMunicipalAnalysisResponse([
          {
            sys: { id: "municipal-1" },
            panelLayerId: "layer-1",
            imageData: compressImageData({
              templates: {
                municipality:
                  "No município de {name}, predomina a classe {label} com {value}% da área analisada.",
              },
              years: {
                "2026-01": {
                  valuesScale: 1,
                  values: {
                    "2914802": [12, 88],
                  },
                },
              },
            }),
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
            defaultYear: "2026-01",
            classes: [
              { id: "a", label: "Classe A", color: "#111111" },
              { id: "b", label: "Classe B", color: "#222222" },
            ],
            years: {
              "2026-01": {
                imageId: "img-2026-01",
                values: {},
              },
            },
          },
        },
      ]);
    });

    const [layer] = await getPanelLayers({ includeMunicipalAnalysis: true });
    const imageData = layer?.imageData as {
      years: Record<string, { values: Record<string, number[]> }>;
      templates?: { municipality?: string };
    };

    expect(imageData.years["2026-01"]?.values["2914802"]).toEqual([12, 88]);
    expect(imageData.templates?.municipality).toContain("No município de");
  });

  it("paginates municipal analysis entries from Contentful", async () => {
    mockedGetContent.mockImplementation(
      async (query: string, variables?: unknown) => {
        if (query.includes("municipalAnalysisCollection")) {
          const skip =
            typeof variables === "object" && variables && "skip" in variables
              ? Number((variables as { skip?: number }).skip)
              : 0;

          if (skip === 0) {
            return {
              municipalAnalysisCollection: {
                total: 101,
                items: Array.from({ length: 100 }, (_, index) => ({
                  sys: { id: `municipal-new-${index}` },
                  panelLayerId: "other-layer",
                  imageData: {
                    years: {
                      "2026-01": {
                        values: {
                          "2914802": [1, 99],
                        },
                      },
                    },
                  },
                })),
              },
            };
          }

          return {
            municipalAnalysisCollection: {
              total: 101,
              items: [
                {
                  sys: { id: "municipal-old" },
                  panelLayerId: "layer-1",
                  imageData: {
                    years: {
                      "2017-10": {
                        values: {
                          "2914802": [33, 67],
                        },
                      },
                    },
                  },
                },
              ],
            },
          };
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
              defaultYear: "2017-10",
              classes: [
                { id: "a", label: "Classe A", color: "#111111" },
                { id: "b", label: "Classe B", color: "#222222" },
              ],
              years: {
                "2017-10": {
                  imageId: "img-2017-10",
                  values: {},
                },
              },
            },
          },
        ]);
      },
    );

    const [layer] = await getPanelLayers({ includeMunicipalAnalysis: true });
    const imageData = layer?.imageData as {
      years: Record<string, { values: Record<string, number[]> }>;
    };

    expect(imageData.years["2017-10"]?.values["2914802"]).toEqual([33, 67]);
    expect(mockedGetContent).toHaveBeenCalledWith(
      expect.stringContaining("municipalAnalysisCollection"),
      { limit: 100, skip: 0 },
      { cache: "no-store" },
    );
    expect(mockedGetContent).toHaveBeenCalledWith(
      expect.stringContaining("municipalAnalysisCollection"),
      { limit: 100, skip: 100 },
      { cache: "no-store" },
    );
  });

  it("merges monthly municipal analysis values into an annual panel layer year", async () => {
    mockedGetContent.mockImplementation(async (query: string) => {
      if (query.includes("municipalAnalysisCollection")) {
        return buildMunicipalAnalysisResponse([
          {
            sys: { id: "municipal-1" },
            panelLayerId: "layer-1",
            imageData: {
              classes: [{ id: "patch-a", label: "Patch A", color: "#aaaaaa" }],
              mapVisualization: {
                min: 0,
                max: 1,
              },
              locations: {
                "2914802": "Itabuna - BA",
              },
              years: {
                "2020-01": {
                  imageId: "municipal-analysis-2020",
                  year: "Janeiro de 2020",
                  valuesScale: 1,
                  values: {
                    "2914802": [65, 35],
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
            defaultYear: "2020",
            classes: [
              { id: "a", label: "Classe A", color: "#111111" },
              { id: "b", label: "Classe B", color: "#222222" },
            ],
            years: {
              "2020": {
                imageId: "gee-carbono-2020",
                valuesScale: 10,
                values: {},
              },
            },
          },
        },
      ]);
    });

    const [layer] = await getPanelLayers({ includeMunicipalAnalysis: true });
    const imageData = layer?.imageData as {
      defaultYear?: string;
      classes: Array<{ id: string }>;
      mapVisualization?: { min?: number; max?: number };
      years: Record<
        string,
        {
          imageId: string;
          year?: string;
          valuesScale?: number;
          values: Record<string, number[]>;
        }
      >;
    };

    expect(Object.keys(imageData.years)).toEqual(["2020"]);
    expect(imageData.defaultYear).toBe("2020");
    expect(imageData.classes.map((item) => item.id)).toEqual(["a", "b"]);
    expect(imageData.mapVisualization).toBeUndefined();
    expect(imageData.years["2020"]?.imageId).toBe("gee-carbono-2020");
    expect(imageData.years["2020"]?.year).toBeUndefined();
    expect(imageData.years["2020"]?.valuesScale).toBe(10);
    expect(imageData.years["2020"]?.values["2914802"]).toEqual([650, 350]);
    expect(imageData.years["2020-01"]).toBeUndefined();
  });

  it("fetches a single panel layer by id before attaching municipal analysis", async () => {
    mockedGetContent.mockImplementation(async (query: string) => {
      if (query.includes("municipalAnalysisCollection")) {
        return buildMunicipalAnalysisResponse([]);
      }

      return buildPanelLayerResponse([
        {
          sys: { id: "sys-1" },
          id: "CDI_Test",
          name: "CDI",
          description: "",
          category: "Dados Climáticos",
          panelPosition: 1,
          previewMap: { url: "https://example.com/map.png" },
          imageData: {
            schemaVersion: 1,
            type: "territorial-compact",
            classes: [],
            years: {},
          },
        },
      ]);
    });

    const layer = await getPanelLayerWithMunicipalAnalysis("CDI_Test");

    expect(layer?.id).toBe("CDI_Test");
    expect(mockedGetContent).toHaveBeenCalledWith(
      expect.stringContaining("GetPanelLayerById"),
      { id: "CDI_Test" },
    );
    expect(mockedGetContent).toHaveBeenCalledWith(
      expect.stringContaining("municipalAnalysisCollection"),
      { limit: 100, skip: 0, panelLayerId: "CDI_Test" },
      { cache: "no-store" },
    );
  });

  it("fetches annual municipal analysis partition for a requested monthly year", async () => {
    mockedGetContent.mockImplementation(async (query: string) => {
      if (query.includes("GetMunicipalAnalysisByPanelLayerAndPartition")) {
        return buildMunicipalAnalysisResponse([
          {
            sys: { id: "municipal-2026" },
            title: "Municipal Analysis CDI_Test 2026",
            panelLayerId: "CDI_Test",
            partitionKey: "2026",
            imageData: {
              years: {
                "2026-02": {
                  values: {
                    "2914802": [90, 10],
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
          id: "CDI_Test",
          name: "CDI",
          description: "",
          category: "Dados Climáticos",
          panelPosition: 1,
          previewMap: { url: "https://example.com/map.png" },
          imageData: {
            schemaVersion: 1,
            type: "territorial-compact",
            defaultYear: "2026-01",
            classes: [
              { id: "a", label: "Classe A", color: "#111111" },
              { id: "b", label: "Classe B", color: "#222222" },
            ],
            years: {
              "2026-01": {
                imageId: "img-2026-01",
                values: {},
              },
              "2026-02": {
                imageId: "img-2026-02",
                values: {},
              },
            },
          },
        },
      ]);
    });

    const layer = await getPanelLayerWithMunicipalAnalysisYear(
      "CDI_Test",
      "2026-02",
    );
    const imageData = layer?.imageData as {
      years: Record<
        string,
        { imageId: string; values: Record<string, number[]> }
      >;
    };

    expect(Object.keys(imageData.years)).toEqual(["2026-02"]);
    expect(imageData.years["2026-02"]?.imageId).toBe("img-2026-02");
    expect(imageData.years["2026-02"]?.values["2914802"]).toEqual([90, 10]);
    expect(mockedGetContent).toHaveBeenCalledWith(
      expect.stringContaining("GetMunicipalAnalysisByPanelLayerAndPartition"),
      {
        limit: 100,
        skip: 0,
        panelLayerId: "CDI_Test",
        partitionKey: "2026",
      },
      { cache: "no-store" },
    );
  });

  it("falls back to monthly municipal analysis partitions when annual partition is unavailable", async () => {
    mockedGetContent.mockImplementation(
      async (query: string, variables?: Record<string, unknown>) => {
        if (query.includes("GetMunicipalAnalysisByPanelLayerAndPartition")) {
          if (variables?.partitionKey === "2026") {
            return buildMunicipalAnalysisResponse([]);
          }

          if (variables?.partitionKey === "2026-02") {
            return buildMunicipalAnalysisResponse([
              {
                sys: { id: "municipal-2026-02" },
                title: "Municipal Analysis CDI_Test 2026-02",
                panelLayerId: "CDI_Test",
                partitionKey: "2026-02",
                imageData: {
                  years: {
                    "2026-02": {
                      values: {
                        "2914802": [90, 10],
                      },
                    },
                  },
                },
              },
            ]);
          }

          return buildMunicipalAnalysisResponse([]);
        }

        if (query.includes("municipalAnalysisCollection")) {
          throw new Error("A coleção municipalAnalysis não deve ser varrida quando os metadados de partição existem.");
        }

        return buildPanelLayerResponse([
          {
            sys: { id: "sys-1" },
            id: "CDI_Test",
            name: "CDI",
            description: "",
            category: "Dados Climáticos",
            panelPosition: 1,
            previewMap: { url: "https://example.com/map.png" },
            imageData: {
              schemaVersion: 1,
              type: "territorial-compact",
              defaultYear: "2026-01",
              classes: [
                { id: "a", label: "Classe A", color: "#111111" },
                { id: "b", label: "Classe B", color: "#222222" },
              ],
              years: {
                "2026-01": {
                  imageId: "img-2026-01",
                  values: {},
                },
                "2026-02": {
                  imageId: "img-2026-02",
                  values: {},
                },
              },
            },
          },
        ]);
      },
    );

    const layer = await getPanelLayerWithMunicipalAnalysisYear(
      "CDI_Test",
      "2026-02",
    );
    const imageData = layer?.imageData as {
      years: Record<string, { values: Record<string, number[]> }>;
    };

    expect(Object.keys(imageData.years)).toEqual(["2026-02"]);
    expect(imageData.years["2026-02"]?.values["2914802"]).toEqual([90, 10]);
    expect(mockedGetContent).toHaveBeenCalledWith(
      expect.stringContaining("GetMunicipalAnalysisByPanelLayerAndPartition"),
      {
        limit: 100,
        skip: 0,
        panelLayerId: "CDI_Test",
        partitionKey: "2026-02",
      },
      { cache: "no-store" },
    );
  });

  it("falls back to partition titles when Contentful metadata fields are unavailable", async () => {
    mockedGetContent.mockImplementation(async (query: string) => {
      if (query.includes("GetMunicipalAnalysisByPanelLayerAndPartition")) {
        throw new Error("Cannot query field partitionKey");
      }

      if (query.includes("municipalAnalysisCollection")) {
        return buildMunicipalAnalysisResponse([
          {
            sys: { id: "municipal-2026-01" },
            title: "Municipal Analysis CDI_Test 2026-01",
            panelLayerId: "CDI_Test",
            imageData: {
              years: {
                "2026-01": {
                  values: {
                    "2914802": [10, 90],
                  },
                },
              },
            },
          },
          {
            sys: { id: "municipal-2026-02" },
            title: "Municipal Analysis CDI_Test 2026-02",
            panelLayerId: "CDI_Test",
            imageData: {
              years: {
                "2026-02": {
                  values: {
                    "2914802": [90, 10],
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
          id: "CDI_Test",
          name: "CDI",
          description: "",
          category: "Dados Climáticos",
          panelPosition: 1,
          previewMap: { url: "https://example.com/map.png" },
          imageData: {
            schemaVersion: 1,
            type: "territorial-compact",
            classes: [
              { id: "a", label: "Classe A", color: "#111111" },
              { id: "b", label: "Classe B", color: "#222222" },
            ],
            years: {
              "2026-01": {
                imageId: "img-2026-01",
                values: {},
              },
              "2026-02": {
                imageId: "img-2026-02",
                values: {},
              },
            },
          },
        },
      ]);
    });

    const layer = await getPanelLayerWithMunicipalAnalysisYear(
      "CDI_Test",
      "2026-02",
    );
    const imageData = layer?.imageData as {
      years: Record<string, { values: Record<string, number[]> }>;
    };

    expect(Object.keys(imageData.years)).toEqual(["2026-02"]);
    expect(imageData.years["2026-02"]?.values["2914802"]).toEqual([90, 10]);
  });
});
