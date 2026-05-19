import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/infrastructure/contentful/client", () => ({
  getContent: vi.fn(),
}));

import { getContent } from "@/infrastructure/contentful/client";
import { getPanelLayers } from "@/repositories/platform/panelLayerRepository";

const mockedGetContent = vi.mocked(getContent);

describe("panelLayerRepository", () => {
  beforeEach(() => {
    mockedGetContent.mockReset();
  });

  it("ignores null panel layer items from Contentful", async () => {
    mockedGetContent.mockResolvedValue({
      panelLayerCollection: {
        items: [
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
        ],
      },
    });

    const layers = await getPanelLayers();

    expect(layers).toHaveLength(1);
    expect(layers[0]?.id).toBe("layer-1");
    expect(layers[0]?.category).toBe("cat");
  });

  it("preserves category values and sorts by panel position", async () => {
    mockedGetContent.mockResolvedValue({
      panelLayerCollection: {
        items: [
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
        ],
      },
    });

    const layers = await getPanelLayers();

    expect(layers.map((layer) => layer.id)).toEqual(["layer-1", "layer-2"]);
    expect(layers.map((layer) => layer.category)).toEqual([
      "Dados Climáticos",
      "Categoria Livre",
    ]);
  });
});
