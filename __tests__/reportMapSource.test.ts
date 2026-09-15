import { describe, expect, it } from "vitest";
import { resolveMapSource } from "@/components/MunicipalReport/reportMapSource";

const CHOROPLETH_PATH =
  "/api/municipal-analysis/populacao-indigena/choropleth?locationKey=2504009";

describe("resolveMapSource", () => {
  it("draws the Earth Engine raster when there is a tile url", () => {
    expect(
      resolveMapSource("https://ee/tiles/{z}/{x}/{y}", undefined, undefined),
    ).toEqual({ kind: "raster", tileUrl: "https://ee/tiles/{z}/{x}/{y}" });
  });

  // Regressão: `municipal_choropleth` era tratado como "sem imagem no período",
  // então todo índice publicado a partir de uma coluna da planilha saía do
  // relatório e da prévia do catálogo com um retângulo cinza.
  it("draws the municipal choropleth instead of reporting a missing period", () => {
    expect(
      resolveMapSource(undefined, "municipal_choropleth", CHOROPLETH_PATH),
    ).toEqual({ kind: "choropleth", path: CHOROPLETH_PATH });
  });

  it("has nothing to draw when the choropleth has no address to ask", () => {
    expect(
      resolveMapSource(undefined, "municipal_choropleth", undefined),
    ).toBeNull();
  });

  it("does not draw a raster for a layer that failed for another reason", () => {
    expect(
      resolveMapSource("https://ee/tiles", "year_not_found", undefined),
    ).toBeNull();
    expect(
      resolveMapSource("https://ee/tiles", "rate_limited", CHOROPLETH_PATH),
    ).toBeNull();
  });

  it("has nothing to draw while the tile url has not arrived", () => {
    expect(resolveMapSource(undefined, undefined, CHOROPLETH_PATH)).toBeNull();
  });
});
