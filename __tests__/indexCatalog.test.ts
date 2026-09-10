import { describe, expect, it } from "vitest";
import {
  catalogLayerClassCount,
  createCatalogPanelLayerId,
  detectYearPartitionedTemplate,
  expandAssetForPeriod,
  fillYearPlaceholder,
  inferTimeScale,
  makeUniqueCatalogPanelLayerId,
  parseIndexCatalogDraftInput,
  parseIndexCatalogPresentationInput,
  hasPublishableValidation,
  reconcileCatalogPublicationStatus,
  resolvePanelPositionPlan,
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

/**
 * O formato dos dados socioeconômicos: uma FeatureCollection municipal em que
 * cada ano é uma coluna e que também é o asset que desenha o mapa.
 */
const validValueTableDraft = {
  name: "Registros de Secas e Estiagens",
  description: "Quantidade anual de registros municipais no S2ID.",
  category: "Dados Socioeconômicos",
  statisticsSource: {
    kind: "gee-municipal-value-table",
    asset: { type: "fixed", assetId: "projects/example/assets/s2id" },
    periodGranularity: "year",
    valueProperty: "{year}",
    aggregation: "sum",
    properties: {
      municipalityCode: "CD_MUN",
      locationName: "NM_MUN",
      stateCode: "SIGLA_UF",
    },
  },
  valueIndicator: {
    label: "Registros de secas e estiagens",
    color: "#8c2d04",
    measurementUnit: "registros",
    valueType: "absolute",
  },
  classes: [
    { classIndex: 0, id: "0-6", label: "0 a 6", color: "#FEE5D9" },
    { classIndex: 1, id: "6-12", label: "> 6 a 12", color: "#FCAE91" },
  ],
  earthEngine: {
    strategy: "single",
    sourceType: "featureCollection",
    singleAssetId: "projects/example/assets/s2id",
    property: "{year}",
    thresholds: [6],
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

describe("hasPublishableValidation", () => {
  it("aceita ready e published, os dois estados com prévia gravada", () => {
    expect(hasPublishableValidation("ready")).toBe(true);
    // Republicar parte daqui: as escritas de texto e imagem não tocam a prévia.
    expect(hasPublishableValidation("published")).toBe(true);
  });

  it("recusa os estados em que a prévia foi apagada ou invalidada", () => {
    expect(hasPublishableValidation("draft")).toBe(false);
    expect(hasPublishableValidation("error")).toBe(false);
    expect(hasPublishableValidation("legacy")).toBe(false);
  });
});

describe("parseIndexCatalogPresentationInput", () => {
  const validPresentation = {
    name: "Registros de Secas e Estiagens",
    description: "Ocorrências registradas no S2iD.",
    category: "Dados Climáticos",
    measurementUnit: "registros",
    panelPosition: "4",
  };

  it("aceita a unidade do legado em vez de normalizar para %", () => {
    expect(parseIndexCatalogPresentationInput(validPresentation)).toEqual({
      name: "Registros de Secas e Estiagens",
      description: "Ocorrências registradas no S2iD.",
      category: "Dados Climáticos",
      measurementUnit: "registros",
      panelPosition: 4,
    });
  });

  it("não aceita configuração de dados, que mudaria os números do índice", () => {
    const parsed = parseIndexCatalogPresentationInput({
      ...validPresentation,
      statisticsSource: { kind: "gee-feature-collection" },
      classes: [{ classIndex: 0, label: "x", color: "#000000" }],
      earthEngine: { strategy: "single", sourceType: "image" },
    }) as Record<string, unknown>;

    expect(parsed.statisticsSource).toBeUndefined();
    expect(parsed.classes).toBeUndefined();
    expect(parsed.earthEngine).toBeUndefined();
  });

  it("omite a posição quando o campo vem vazio", () => {
    expect(
      parseIndexCatalogPresentationInput({
        ...validPresentation,
        panelPosition: "",
      }),
    ).not.toHaveProperty("panelPosition");
  });

  it("recusa unidade em branco, categoria desconhecida e posição negativa", () => {
    expect(() =>
      parseIndexCatalogPresentationInput({
        ...validPresentation,
        measurementUnit: "   ",
      }),
    ).toThrow("Unidade de medida");
    expect(() =>
      parseIndexCatalogPresentationInput({
        ...validPresentation,
        category: "Dados Inventados",
      }),
    ).toThrow("Categoria inválida.");
    expect(() =>
      parseIndexCatalogPresentationInput({
        ...validPresentation,
        panelPosition: "-2",
      }),
    ).toThrow("maior ou igual a zero");
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

  it("accepts a municipal value table with its indicator", () => {
    const parsed = parseIndexCatalogDraftInput(validValueTableDraft);

    expect(parsed.statisticsSource).toMatchObject({
      kind: "gee-municipal-value-table",
      valueProperty: "{year}",
      aggregation: "sum",
    });
    expect(parsed.valueIndicator).toEqual({
      label: "Registros de secas e estiagens",
      color: "#8C2D04",
      measurementUnit: "registros",
      valueType: "absolute",
    });
  });

  it("requires an indicator and at least two colour ranges for a value table", () => {
    expect(() =>
      parseIndexCatalogDraftInput({
        ...validValueTableDraft,
        valueIndicator: undefined,
      }),
    ).toThrow("Descreva o indicador");
    expect(() =>
      parseIndexCatalogDraftInput({
        ...validValueTableDraft,
        classes: validValueTableDraft.classes.slice(0, 1),
      }),
    ).toThrow("duas faixas de cor");
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
    {
      entryId: "anaseca",
      name: "Monitor de seca | ANA",
      category: "Dados Climáticos",
      panelPosition: 0,
    },
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
      resolvePanelPositionPlan(climaticos, {
        entryId: "novo",
        category: "Dados Climáticos",
      }),
    ).toEqual({ position: 11 });
  });

  it("ignora as posições das outras categorias", () => {
    expect(
      resolvePanelPositionPlan(climaticos, {
        entryId: "novo",
        category: "Dados Ambientais",
      }),
    ).toEqual({ position: 0 });
  });

  it("mantém a posição que o índice já tem quando ninguém pediu outra", () => {
    expect(
      resolvePanelPositionPlan(climaticos, {
        entryId: "novo",
        category: "Dados Climáticos",
        currentPosition: 7,
      }),
    ).toEqual({ position: 7 });
  });

  it("respeita a posição livre que o formulário pediu", () => {
    expect(
      resolvePanelPositionPlan(climaticos, {
        entryId: "novo",
        category: "Dados Climáticos",
        requestedPosition: 3,
        currentPosition: 11,
      }),
    ).toEqual({ position: 3 });
  });

  it("troca de lugar com o índice que já estava na posição pedida", () => {
    // Regressão: teste-temperatura foi publicado com posição 0, empatado com
    // anaseca, e apareceu como primeiro em Dados Climáticos. Antes o empate era
    // desfeito jogando o índice novo para o fim da categoria, ignorando o que o
    // operador pediu; agora os dois trocam de posição.
    expect(
      resolvePanelPositionPlan(climaticos, {
        entryId: "novo",
        category: "Dados Climáticos",
        requestedPosition: 0,
        currentPosition: 15,
      }),
    ).toEqual({
      position: 0,
      swap: {
        entryId: "anaseca",
        name: "Monitor de seca | ANA",
        panelLayerId: undefined,
        position: 15,
      },
    });
  });

  it("dá ao ocupante a posição que sobra quando o índice novo ainda não tem uma", () => {
    expect(
      resolvePanelPositionPlan(climaticos, {
        entryId: "novo",
        category: "Dados Climáticos",
        requestedPosition: 1,
      }),
    ).toMatchObject({
      position: 1,
      swap: { entryId: "cemadenseca", position: 11 },
    });
  });

  it("não troca nada quando a posição pedida é a que o índice já ocupa", () => {
    expect(
      resolvePanelPositionPlan(
        [
          ...climaticos,
          { entryId: "novo", category: "Dados Climáticos", panelPosition: 4 },
        ],
        {
          entryId: "novo",
          category: "Dados Climáticos",
          requestedPosition: 4,
          currentPosition: 4,
        },
      ),
    ).toEqual({ position: 4 });
  });
});

describe("detectYearPartitionedTemplate", () => {
  it("turns a concrete year asset into the {year} template the contract expects", () => {
    expect(
      detectYearPartitionedTemplate(
        "projects/obscaatinga/assets/Estatisticas/Estatistica_Multinivel_MonitorANA_2026",
      ),
    ).toEqual({
      year: "2026",
      assetIdTemplate:
        "projects/obscaatinga/assets/Estatisticas/Estatistica_Multinivel_MonitorANA_{year}",
    });
  });

  it("uses the last year so folders named after a year are preserved", () => {
    expect(
      detectYearPartitionedTemplate(
        "projects/x/assets/Estatisticas_2020/ana_2026",
      )?.assetIdTemplate,
    ).toBe("projects/x/assets/Estatisticas_2020/ana_{year}");
  });

  it("refuses ids without a four-digit year or already templated", () => {
    expect(
      detectYearPartitionedTemplate("projects/x/assets/estatisticas"),
    ).toBeNull();
    expect(
      detectYearPartitionedTemplate("projects/x/assets/ana_202"),
    ).toBeNull();
    expect(
      detectYearPartitionedTemplate("projects/x/assets/ana_{year}"),
    ).toBeNull();
    expect(detectYearPartitionedTemplate("   ")).toBeNull();
  });

  it("ignores longer digit runs that only look like a year", () => {
    expect(
      detectYearPartitionedTemplate("projects/x/assets/ana_20261"),
    ).toBeNull();
  });
});

describe("fillYearPlaceholder", () => {
  it("shows the operator the concrete year again", () => {
    expect(fillYearPlaceholder("projects/x/assets/ana_{year}", "2026")).toBe(
      "projects/x/assets/ana_2026",
    );
  });

  it("keeps the template when no year is known yet", () => {
    expect(fillYearPlaceholder("projects/x/assets/ana_{year}")).toBe(
      "projects/x/assets/ana_{year}",
    );
  });
});

describe("catalogLayerClassCount", () => {
  const ranges = [
    { classIndex: 0, id: "0-6", label: "0 a 6", color: "#FEE5D9" },
    { classIndex: 1, id: "6-12", label: "> 6 a 12", color: "#FCAE91" },
  ];

  it("conta uma classe só numa tabela municipal de valor único", () => {
    // As faixas configuradas são as cores do mapa; a camada publicada tem uma
    // classe, o indicador. Passar 2 faz a leitura estatística recusar o asset.
    expect(
      catalogLayerClassCount({ kind: "gee-municipal-value-table" }, ranges),
    ).toBe(1);
  });

  it("conta as classes configuradas numa tabela classificatória", () => {
    expect(
      catalogLayerClassCount({ kind: "gee-feature-collection" }, ranges),
    ).toBe(2);
    expect(catalogLayerClassCount(undefined, ranges)).toBe(2);
  });
});
