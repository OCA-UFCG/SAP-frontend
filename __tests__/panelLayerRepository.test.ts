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
  });
});
