import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/infrastructure/contentful/client", () => ({
  CONTENTFUL_COLLECTION_LIMIT: 200,
  getContent: vi.fn(),
}));

import {
  buildPanelLayerMessages,
  mergeMessages,
} from "@/translations/panelLayerMessages";

const LAYER = {
  name: "Índice de Aridez - BR-DWGD",
  description: "Índice de Aridez calculado com o BR-DWGD",
  nameEn: "Aridity Index - BR-DWGD",
  nameEs: " ",
  descriptionEn: "Aridity Index calculated from BR-DWGD",
  descriptionEs: null,
  classLabelsEn: { "Subúmido Seco": "Dry subhumid", "< 0,58": "< 0.58" },
  classLabelsEs: { "Subúmido Seco": "Subhúmedo seco", Árido: "" },
};

describe("buildPanelLayerMessages", () => {
  it("puts each index under the keys the platform already looks up", () => {
    expect(buildPanelLayerMessages([LAYER, null], "en")).toEqual({
      ModulesContext: {
        Layers: {
          "indice-de-aridez-br-dwgd": {
            title: "Aridity Index - BR-DWGD",
            description: "Aridity Index calculated from BR-DWGD",
          },
        },
      },
      PlatformMapCaption: {
        labels: {
          "subumido-seco": "Dry subhumid",
          "menor-que-0-58": "< 0.58",
        },
      },
    });
  });

  it("leaves blank translations out so the Portuguese text shows", () => {
    expect(buildPanelLayerMessages([LAYER], "es")).toEqual({
      ModulesContext: { Layers: {} },
      PlatformMapCaption: { labels: { "subumido-seco": "Subhúmedo seco" } },
    });
  });

  it("has nothing to add in Portuguese", () => {
    expect(buildPanelLayerMessages([LAYER], "pt")).toBeNull();
  });

  it("keeps braces typed in the catalog as plain text", () => {
    const messages = buildPanelLayerMessages(
      [{ ...LAYER, nameEn: "Index {beta} d'água" }],
      "en",
    );
    expect(
      messages?.ModulesContext.Layers["indice-de-aridez-br-dwgd"].title,
    ).toBe("Index '{'beta'}' d''água");
  });
});

describe("mergeMessages", () => {
  it("overrides only the keys that came from Contentful", () => {
    expect(
      mergeMessages(
        {
          ModulesContext: {
            title: "Modules",
            Layers: {
              a: { title: "A", description: "Desc A" },
              b: { title: "B" },
            },
          },
        },
        { ModulesContext: { Layers: { a: { title: "A from CMS" } } } },
      ),
    ).toEqual({
      ModulesContext: {
        title: "Modules",
        Layers: {
          a: { title: "A from CMS", description: "Desc A" },
          b: { title: "B" },
        },
      },
    });
  });
});
