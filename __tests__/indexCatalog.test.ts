import { describe, expect, it } from "vitest";
import {
  createCatalogPanelLayerId,
  expandAssetForPeriod,
  fileNameMatchesCatalogTag,
  inferTimeScale,
  makeUniqueCatalogPanelLayerId,
  parseIndexCatalogDraftInput,
} from "@/utils/indexCatalog";

const validDraft = {
  name: "Índice de Aridez",
  description: "Descrição curta",
  category: "Dados Climáticos",
  sourceTag: "aridez",
  selectedFiles: [
    {
      id: "drive-1",
      name: "Aridez.csv",
      mimeType: "text/csv",
      modifiedTime: "2026-07-30T12:00:00.000Z",
      inspection: {
        role: "multilevel",
        columns: ["NIVEL_AGRUPAMENTO", "valor_classe_1"],
        periods: ["2025"],
        classColumns: ["valor_classe_1"],
        warnings: [],
      },
    },
  ],
  valueType: "absolute",
  unit: "mm",
  classes: [
    {
      column: "valor_classe_1",
      id: "medida",
      label: "Medida",
      color: "#989F43",
      pixelValue: 1,
    },
  ],
  earthEngine: {
    strategy: "single",
    sourceType: "image",
    singleAssetId: "projects/example/assets/aridez",
  },
};

describe("index catalog input helpers", () => {
  it("matches a literal Drive tag ignoring case and accents", () => {
    expect(
      fileNameMatchesCatalogTag(
        "ÍNDICE_Desertificação_Municipios.csv",
        "indice_desertificacao",
      ),
    ).toBe(true);
    expect(fileNameMatchesCatalogTag("aridez.csv", "seca")).toBe(false);
  });

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

  it("normalizes percentage units and rejects incomplete assets", () => {
    expect(
      parseIndexCatalogDraftInput({
        ...validDraft,
        valueType: "percentage",
        unit: "qualquer",
      }).unit,
    ).toBe("%");

    expect(() =>
      parseIndexCatalogDraftInput({
        ...validDraft,
        earthEngine: {
          strategy: "perPeriod",
          sourceType: "image",
        },
      }),
    ).toThrow("padrão ou os assets por período");
  });

  it("expands per-period asset patterns and infers periodicity", () => {
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
