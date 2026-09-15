import { describe, expect, it, vi } from "vitest";
import {
  buildSheetChoroplethPath,
  fetchSheetChoropleth,
  paintsMunicipalChoropleth,
} from "@/components/Map/sheetChoropleth";
import type { IEEInfo } from "@/utils/interfaces";

function layer(mapVisualization: Record<string, unknown>): IEEInfo {
  return {
    id: "populacao-indigena",
    imageData: {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2022",
      classes: [
        { id: "populacao-indigena", label: "Indicador", color: "#BD0026" },
      ],
      locations: { br: "Brasil" },
      years: {
        "2022": {
          imageId: "planilha-amfe:pct_rede_2022",
          valuesScale: 1,
          values: {},
        },
      },
      mapVisualization,
    },
  } as unknown as IEEInfo;
}

describe("paintsMunicipalChoropleth", () => {
  it("recognizes the mark the catalog publishes in imageData", () => {
    expect(
      paintsMunicipalChoropleth(
        layer({ municipalChoropleth: { source: "amfe-sheet", column: "ips" } }),
      ),
    ).toBe(true);
  });

  it("leaves a raster layer alone", () => {
    expect(paintsMunicipalChoropleth(layer({ palette: ["#000"] }))).toBe(false);
    expect(paintsMunicipalChoropleth(null)).toBe(false);
  });
});

describe("buildSheetChoroplethPath", () => {
  it("points at the published layer by default", () => {
    expect(buildSheetChoroplethPath("populacao-indigena")).toBe(
      "/api/municipal-analysis/populacao-indigena/choropleth",
    );
  });

  // A prévia do catálogo desenha um rascunho, que ainda não é um panelLayer
  // publicado: a rota pública não teria o que ler.
  it("follows the draft route when the layer is a preview", () => {
    expect(
      buildSheetChoroplethPath(
        "populacao-indigena",
        "/api/index-catalog/drafts/abc123/ee",
      ),
    ).toBe("/api/index-catalog/drafts/abc123/choropleth");
  });

  // Regressão: o mapa do relatório enquadra um município e baixava a
  // classificação do país inteiro para pintar um polígono.
  it("asks for a single municipality when given one", () => {
    expect(
      buildSheetChoroplethPath("populacao-indigena", undefined, "2504009"),
    ).toBe(
      "/api/municipal-analysis/populacao-indigena/choropleth?locationKey=2504009",
    );
  });
});

describe("fetchSheetChoropleth", () => {
  it("returns the classification in the shape the map layers consume", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          column: "ips",
          classificationByCode: { "2504009": 1 },
          excludedCodes: [],
          palette: ["#FFFFCC", "#BD0026"],
        }),
      ),
    );

    await expect(fetchSheetChoropleth("/choropleth")).resolves.toEqual({
      classificationByCode: { "2504009": 1 },
      excludedCodes: [],
      palette: ["#FFFFCC", "#BD0026"],
    });
    vi.unstubAllGlobals();
  });

  it("fails loudly when the route refuses the layer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("", { status: 404 })),
    );

    await expect(fetchSheetChoropleth("/choropleth")).rejects.toThrow("404");
    vi.unstubAllGlobals();
  });
});
