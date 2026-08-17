import { describe, expect, it } from "vitest";
import {
  createCatalogPanelLayerId,
  expandAssetForPeriod,
  inferTimeScale,
  makeUniqueCatalogPanelLayerId,
  parseIndexCatalogDraftInput,
} from "@/utils/indexCatalog";

const validDraft = {
  name: "Índice de Aridez",
  description: "Descrição curta",
  category: "Dados Climáticos",
  statisticsSource: {
    kind: "gee-feature-collection",
    asset: {
      type: "fixed",
      assetId: "projects/example/assets/aridez_stats",
    },
    periodGranularity: "year",
    properties: {
      level: "NIVEL_AGRUPAMENTO",
      locationName: "NOME_LOCAL",
      municipalityCode: "CD_MUN",
      stateCode: "NM_UF",
      year: "ano",
      date: "data_img",
      totalArea: "area_total_ha",
    },
  },
  classes: [
    {
      classIndex: 1,
      id: "seco",
      label: "Seco",
      color: "#989F43",
      pixelValue: 1,
    },
  ],
  earthEngine: {
    strategy: "single",
    sourceType: "image",
    singleAssetId: "projects/example/assets/aridez_map",
  },
};

describe("index catalog v2 input helpers", () => {
  it("creates normalized unique technical ids", () => {
    expect(createCatalogPanelLayerId("Índice Água / Solo")).toBe(
      "indice-agua-solo",
    );
    expect(
      makeUniqueCatalogPanelLayerId("Índice Água", [
        "indice-agua",
        "indice-agua-2",
      ]),
    ).toBe("indice-agua-3");
  });

  it("accepts only a FeatureCollection statistics source", () => {
    const parsed = parseIndexCatalogDraftInput(validDraft);
    expect(parsed.statisticsSource.kind).toBe("gee-feature-collection");
    expect(parsed.classes[0]).toEqual(
      expect.objectContaining({ classIndex: 1, color: "#989F43" }),
    );

    expect(() =>
      parseIndexCatalogDraftInput({ ...validDraft, statisticsSource: null }),
    ).toThrow("FeatureCollection");
  });

  it("allows inferred classes and rejects incomplete map assets", () => {
    expect(
      parseIndexCatalogDraftInput({ ...validDraft, classes: [] }).classes,
    ).toEqual([]);
    expect(() =>
      parseIndexCatalogDraftInput({
        ...validDraft,
        earthEngine: { strategy: "perPeriod", sourceType: "image" },
      }),
    ).toThrow("template ou os assets de mapa");
  });

  it("expands period templates and infers periodicity", () => {
    expect(
      expandAssetForPeriod(
        {
          strategy: "perPeriod",
          sourceType: "image",
          assetPattern: "projects/x/{year}/asset_{month}_{period}",
        },
        "2026-07",
      ),
    ).toBe("projects/x/2026/asset_07_2026-07");
    expect(inferTimeScale(["2024", "2025"])).toBe("Anual");
    expect(inferTimeScale(["2025-12", "2026-01"])).toBe("Mensal");
  });
});
