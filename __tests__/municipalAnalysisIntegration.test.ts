import { beforeEach, describe, expect, it, vi } from "vitest";
import { gzipSync } from "node:zlib";
import type { PanelLayerI } from "@/utils/interfaces";
import { mergePartialMunicipalImageData } from "@/utils/municipalAnalysisMerge";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/server-session", () => ({
  requireAuthenticatedRequest: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/infrastructure/contentful/client", () => ({
  getContent: vi.fn(),
}));

import { GET } from "@/app/api/municipal-analysis/[panelLayerId]/route";
import { getContent } from "@/infrastructure/contentful/client";
import { clearMunicipalAnalysisCacheForTests } from "@/repositories/platform/municipalAnalysisCache";

const mockedGetContent = vi.mocked(getContent);

function compressImageData(imageData: unknown) {
  return {
    type: "territorial-compact-compressed",
    encoding: "gzip+base64",
    data: gzipSync(Buffer.from(JSON.stringify(imageData), "utf8")).toString(
      "base64",
    ),
  };
}

function buildBaseLayer(): PanelLayerI {
  return {
    sys: { id: "sys-layer-1" },
    id: "layer-1",
    name: "Layer 1",
    description: "Layer 1",
    previewMap: { url: "https://example.com/map.png" },
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
            br: [400, 600],
            ba: [300, 700],
          },
        },
      },
    },
  };
}

describe("municipal analysis Contentful route integration", () => {
  beforeEach(() => {
    clearMunicipalAnalysisCacheForTests();
    mockedGetContent.mockReset();
  });

  it("loads a Contentful partition through repository, cache and route, then merges on the client contract", async () => {
    const baseLayer = buildBaseLayer();

    mockedGetContent.mockImplementation(async (query: string) => {
      if (query.includes("panelLayerCollection")) {
        return {
          panelLayerCollection: {
            items: [baseLayer],
          },
        };
      }

      if (
        query.includes("municipalAnalysisCollection") &&
        query.includes("partitionKey")
      ) {
        return {
          municipalAnalysisCollection: {
            total: 1,
            items: [
              {
                sys: { id: "municipal-2026" },
                title: "Municipal Analysis layer-1 2026",
                panelLayerId: "layer-1",
                partitionKey: "2026",
                calendarYear: "2026",
                territory: "municipality",
                imageData: compressImageData({
                  type: "territorial-compact",
                  locations: {
                    "2914802": "Itabuna - BA",
                  },
                  years: {
                    "2026": {
                      valuesScale: 1,
                      values: {
                        "2914802": [80, 20],
                      },
                    },
                  },
                }),
              },
            ],
          },
        };
      }

      return {
        municipalAnalysisCollection: {
          total: 0,
          items: [],
        },
      };
    });

    const response = await GET(
      new Request(
        "https://example.test/api/municipal-analysis/layer-1?year=2026-02",
      ),
      {
        params: Promise.resolve({ panelLayerId: "layer-1" }),
      },
    );

    expect(response.status).toBe(200);

    const body = (await response.json()) as {
      imageData: PanelLayerI["imageData"];
    };
    const mergedImageData = mergePartialMunicipalImageData(
      baseLayer.imageData,
      body.imageData,
    );

    expect(mergedImageData && "years" in mergedImageData).toBe(true);
    expect(
      mergedImageData && "years" in mergedImageData
        ? mergedImageData.years["2026-02"]?.values["2914802"]
        : null,
    ).toEqual([800, 200]);
    expect(mockedGetContent).toHaveBeenCalledTimes(2);
  });
});
