import { describe, expect, it } from "vitest";

import { parseAmfeSheetColumnSource } from "@/contracts/amfeSheetColumn";
import { parseGeeStatisticsSource } from "@/contracts/geeStatistics";
import { validateImageDataContract } from "@/contracts/imageDataContract.mjs";

const source = {
  kind: "amfe-sheet-column",
  column: "ips",
  periodKey: "2024",
  aggregation: "mean",
};

describe("parseAmfeSheetColumnSource", () => {
  it("accepts a complete source", () => {
    expect(parseAmfeSheetColumnSource(source)).toEqual(source);
  });

  it("is chosen by kind among the statistics sources", () => {
    expect(parseGeeStatisticsSource(source).kind).toBe("amfe-sheet-column");
  });

  it("refuses a source without a column", () => {
    expect(() =>
      parseAmfeSheetColumnSource({ ...source, column: "  " }),
    ).toThrowError(/Escolha a coluna/u);
  });

  // Sem ano escrito a camada nasceria sem período, e o Monitoramento não teria
  // o que selecionar.
  it("refuses a display year that is not four digits", () => {
    expect(() =>
      parseAmfeSheetColumnSource({ ...source, periodKey: "24" }),
    ).toThrowError(/quatro dígitos/u);
  });

  it("refuses an aggregation it does not know", () => {
    expect(() =>
      parseAmfeSheetColumnSource({ ...source, aggregation: "median" }),
    ).toThrowError(/soma ou média/u);
  });
});

describe("municipalChoropleth no contrato imageData", () => {
  const imageData = {
    schemaVersion: 1,
    type: "territorial-compact",
    defaultYear: "2024",
    classes: [{ id: "ips", label: "IPS", color: "#BD0026" }],
    locations: { br: "Brasil" },
    mapVisualization: {
      municipalChoropleth: { source: "amfe-sheet", column: "ips" },
      palette: ["#FFFFCC", "#BD0026"],
      thresholds: [50],
    },
    years: { "2024": { imageId: "planilha-amfe:ips", values: {} } },
  };

  it("accepts a layer painted from a sheet column", () => {
    expect(
      validateImageDataContract(imageData, { context: "panelLayerPublish" }).ok,
    ).toBe(true);
  });

  it("refuses a marker without the column that paints the map", () => {
    const result = validateImageDataContract(
      {
        ...imageData,
        mapVisualization: {
          ...imageData.mapVisualization,
          municipalChoropleth: { source: "amfe-sheet" },
        },
      },
      { context: "panelLayerPublish" },
    );

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("municipalChoropleth.column");
  });

  it("keeps accepting a layer with no marker at all", () => {
    const { municipalChoropleth, ...mapVisualization } =
      imageData.mapVisualization;
    void municipalChoropleth;

    expect(
      validateImageDataContract(
        { ...imageData, mapVisualization },
        { context: "panelLayerPublish" },
      ).ok,
    ).toBe(true);
  });
});
