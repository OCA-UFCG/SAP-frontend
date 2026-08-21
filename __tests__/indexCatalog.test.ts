import { describe, expect, it } from "vitest";
import {
  createCatalogPanelLayerId,
  expandAssetForPeriod,
  inferTimeScale,
  makeUniqueCatalogPanelLayerId,
  parseIndexCatalogDraftInput,
  reconcileCatalogPublicationStatus,
  resolvePanelPositionInCategory,
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

const validationReport = {
  validatedAt: "2026-08-21T18:19:34.000Z",
  valid: true,
  errors: [],
  warnings: [],
  inferred: {
    panelLayerId: "teste-temperatura",
    periods: ["2026-09"],
    classIndexes: [0],
    statisticsAssetCount: 1,
  },
  sourceFingerprint: "f".repeat(64),
};

describe("reconciliação do status de publicação do catálogo", () => {
  it("volta para ready quando a entry marcada como published virou rascunho", () => {
    // Regressão: teste-temperatura ficou com catalogConfig.status "published"
    // numa entry despublicada, e assertPublishable (que só aceita "ready")
    // respondia "Revalide os assets e gere a prévia antes de publicar".
    expect(
      reconcileCatalogPublicationStatus(
        { status: "published", validation: validationReport },
        false,
      ),
    ).toBe("ready");
  });

  it("volta para draft quando não há prévia válida para reaproveitar", () => {
    expect(
      reconcileCatalogPublicationStatus({ status: "published" }, false),
    ).toBe("draft");
    expect(
      reconcileCatalogPublicationStatus(
        {
          status: "published",
          validation: { ...validationReport, valid: false },
        },
        false,
      ),
    ).toBe("draft");
  });

  it("preserva o status quando o Contentful concorda com o catálogo", () => {
    expect(
      reconcileCatalogPublicationStatus({ status: "published" }, true),
    ).toBe("published");
    expect(reconcileCatalogPublicationStatus({ status: "ready" }, false)).toBe(
      "ready",
    );
    expect(reconcileCatalogPublicationStatus({ status: "error" }, false)).toBe(
      "error",
    );
  });
});

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

  it("accepts a forecast ImageCollection selection and normalizes its leads", () => {
    const parsed = parseIndexCatalogDraftInput({
      ...validDraft,
      earthEngine: {
        strategy: "single",
        sourceType: "imageCollection",
        singleAssetId: "projects/example/assets/forecast",
        band: "b1",
        thresholds: [-90, -30, 0, 30, 90],
        collectionSelection: {
          type: "latest-emission-leads",
          emissionProperty: "data_emissao",
          leadProperty: "lead_time",
          targetDateProperty: "system:time_start",
          leadValues: [4, 2, 1, 3],
        },
      },
    });

    expect(parsed.earthEngine.collectionSelection).toEqual(
      expect.objectContaining({
        emissionProperty: "data_emissao",
        targetDateProperty: "system:time_start",
        leadValues: [1, 2, 3, 4],
      }),
    );
  });

  it("rejects forecast selection for a per-period asset", () => {
    expect(() =>
      parseIndexCatalogDraftInput({
        ...validDraft,
        earthEngine: {
          strategy: "perPeriod",
          sourceType: "imageCollection",
          assetPattern: "projects/example/assets/forecast_{period}",
          collectionSelection: {
            type: "latest-emission-leads",
            emissionProperty: "data_emissao",
            leadProperty: "lead_time",
            targetDateProperty: "system:time_start",
            leadValues: [1, 2, 3, 4],
          },
        },
      }),
    ).toThrow("asset único");
  });
});

describe("posição do índice na categoria do Monitoramento", () => {
  const climaticos = [
    { entryId: "anaseca", category: "Dados Climáticos", panelPosition: 0 },
    { entryId: "cemadenseca", category: "Dados Climáticos", panelPosition: 1 },
    { entryId: "aridez", category: "Dados Climáticos", panelPosition: 4 },
    {
      entryId: "precipitacao",
      category: "Dados Climáticos",
      panelPosition: 10,
    },
    { entryId: "pobreza", category: "Dados Socioeconômicos", panelPosition: 9 },
  ];

  it("coloca um índice novo logo depois do último da categoria", () => {
    expect(
      resolvePanelPositionInCategory(climaticos, "Dados Climáticos", "novo"),
    ).toBe(11);
  });

  it("ignora as posições das outras categorias", () => {
    expect(
      resolvePanelPositionInCategory(climaticos, "Dados Ambientais", "novo"),
    ).toBe(0);
  });

  it("mantém a posição que o índice já tem quando ela é só dele", () => {
    expect(
      resolvePanelPositionInCategory(
        [
          ...climaticos,
          { entryId: "novo", category: "Dados Climáticos", panelPosition: 7 },
        ],
        "Dados Climáticos",
        "novo",
      ),
    ).toBe(7);
  });

  it("recalcula uma posição repetida em vez de deixar o índice na frente", () => {
    // Regressão: teste-temperatura foi publicado com posição 0, empatado com
    // anaseca, e apareceu como primeiro em Dados Climáticos.
    expect(
      resolvePanelPositionInCategory(
        [
          ...climaticos,
          { entryId: "novo", category: "Dados Climáticos", panelPosition: 0 },
        ],
        "Dados Climáticos",
        "novo",
      ),
    ).toBe(11);
  });
});
