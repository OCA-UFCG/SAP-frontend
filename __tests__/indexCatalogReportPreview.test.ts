import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const contentful = vi.hoisted(() => ({
  getCatalogEntry: vi.fn(),
  getLocalizedEntryField: vi.fn(),
}));
const gee = vi.hoisted(() => ({ getGeeStatisticsYearPatch: vi.fn() }));

vi.mock("@/services/indexCatalog/contentfulManagement", () => contentful);
vi.mock("@/repositories/platform/geeStatisticsRepository", () => gee);

import { buildIndexCatalogReportPreview } from "@/services/indexCatalog/reportPreviewService";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";

const CAMPINA_GRANDE = "2504009";

const source = {
  schemaVersion: 1 as const,
  sourceRevision: "a".repeat(64),
  kind: "gee-feature-collection" as const,
  asset: { type: "fixed" as const, assetId: "projects/x/assets/stats" },
  periodGranularity: "year" as const,
  properties: {
    level: "NIVEL_AGRUPAMENTO",
    locationName: "NOME_LOCAL",
    municipalityCode: "CD_MUN",
    stateCode: "NM_UF",
    year: "ano",
    date: "data_img",
    totalArea: "area_total_ha",
  },
};

const imageData: CompactTerritorialAnalysisDataset = {
  schemaVersion: 1,
  type: "territorial-compact",
  classes: [
    { id: "arido", label: "Árido", color: "#795548" },
    { id: "semiarido", label: "Semiárido", color: "#c8b273" },
  ],
  years: {
    "2023": { imageId: "img-2023", values: {} },
    "2024": { imageId: "img-2024", values: {} },
  },
};

function stubDraft(
  report?: {
    sections: Array<{ title: string; text: string }>;
    sectionColor?: string;
    methodology?: string;
    severity?: { order: string[]; neutralClassId?: string };
  },
  defaultPeriod = "2024",
) {
  const entry = { sys: { id: "panel", version: 3 }, fields: {} };
  contentful.getCatalogEntry.mockResolvedValue({
    entry,
    locale: "en-US",
    item: {
      entryId: "panel",
      published: false,
      catalogConfig: {
        schemaVersion: 2 as const,
        panelLayerId: "indice-de-aridez-catalogo",
        status: "ready" as const,
        name: "Índice de Aridez",
        description: "Teste",
        category: "Dados Climáticos" as const,
        statisticsSource: source,
        validatedStatisticsSource: source,
        classes: [
          {
            classIndex: 1,
            id: "arido",
            label: "Árido",
            color: "#795548",
            pixelValue: 1,
          },
          {
            classIndex: 2,
            id: "semiarido",
            label: "Semiárido",
            color: "#c8b273",
            pixelValue: 2,
          },
        ],
        earthEngine: {
          strategy: "single" as const,
          sourceType: "image" as const,
          singleAssetId: "projects/x/assets/map",
        },
        createdBy: { uid: "u", email: "e", at: "2026-01-01T00:00:00.000Z" },
        updatedBy: { uid: "u", email: "e", at: "2026-01-01T00:00:00.000Z" },
        validation: {
          validatedAt: "2026-01-01T00:00:00.000Z",
          valid: true,
          errors: [],
          warnings: [],
          inferred: {
            panelLayerId: "indice-de-aridez-catalogo",
            periods: ["2023", "2024"],
            defaultPeriod,
            timeScale: "Anual" as const,
            classIndexes: [1, 2],
            statisticsAssetCount: 1,
          },
          sourceFingerprint: "fingerprint",
        },
        auditLog: [],
        ...(report ? { report: { schemaVersion: 1 as const, ...report } } : {}),
      },
    },
  });
  contentful.getLocalizedEntryField.mockReturnValue(imageData);
}

/**
 * Uma leitura do Earth Engine em que Campina Grande é 16,6% árida em 2024 e
 * 10% em 2023 — dois períodos, que é o mínimo para haver série no gráfico.
 */
const ARIDITY_BY_PERIOD: Record<string, [number, number]> = {
  "2023": [10, 90],
  "2024": [16.6, 83.4],
};

function stubGeeRow() {
  gee.getGeeStatisticsYearPatch.mockImplementation(
    async (_layerId: string, yearKey: string) => ({
      assetId: "projects/x/assets/stats",
      featureCount: 1,
      omittedZeroValueLocationKeys: [],
      metrics: {},
      patch: {
        years: {
          [yearKey]: {
            values: { [CAMPINA_GRANDE]: ARIDITY_BY_PERIOD[yearKey] },
          },
        },
      },
    }),
  );
}

/** Uma tabela municipal de valor único: uma classe na camada, faixas no mapa. */
const valueTableSource = {
  schemaVersion: 1 as const,
  sourceRevision: "b".repeat(64),
  kind: "gee-municipal-value-table" as const,
  asset: { type: "fixed" as const, assetId: "projects/x/assets/municipios" },
  periodGranularity: "year" as const,
  valueProperty: "{year}",
  aggregation: "sum" as const,
  properties: {
    municipalityCode: "CD_MUN",
    locationName: "NM_MUN",
    stateCode: "SIGLA_UF",
  },
};

function stubValueTableDraft() {
  const entry = { sys: { id: "panel", version: 3 }, fields: {} };
  contentful.getCatalogEntry.mockResolvedValue({
    entry,
    locale: "en-US",
    item: {
      entryId: "panel",
      published: false,
      catalogConfig: {
        schemaVersion: 2 as const,
        panelLayerId: "registros-de-secas",
        status: "ready" as const,
        name: "Registros de Secas e Estiagens",
        description: "Teste",
        category: "Dados Socioeconômicos" as const,
        statisticsSource: valueTableSource,
        validatedStatisticsSource: valueTableSource,
        // As faixas de cor do mapa, que não são as classes da camada.
        classes: [
          { classIndex: 0, id: "0-6", label: "0 a 6", color: "#FEE5D9" },
          { classIndex: 1, id: "6-12", label: "> 6 a 12", color: "#FCAE91" },
          { classIndex: 2, id: "12-18", label: "> 12 a 18", color: "#FB6A4A" },
        ],
        valueIndicator: {
          label: "Registros de secas e estiagens",
          color: "#8C2D04",
          measurementUnit: "registros",
          valueType: "absolute" as const,
        },
        earthEngine: {
          strategy: "single" as const,
          sourceType: "featureCollection" as const,
          singleAssetId: "projects/x/assets/municipios",
          property: "{year}",
          thresholds: [6, 12],
        },
        createdBy: { uid: "u", email: "e", at: "2026-01-01T00:00:00.000Z" },
        updatedBy: { uid: "u", email: "e", at: "2026-01-01T00:00:00.000Z" },
        validation: {
          validatedAt: "2026-01-01T00:00:00.000Z",
          valid: true,
          errors: [],
          warnings: [],
          inferred: {
            panelLayerId: "registros-de-secas",
            periods: ["2024"],
            defaultPeriod: "2024",
            timeScale: "Anual" as const,
            classIndexes: [0, 1, 2],
            statisticsAssetCount: 1,
          },
          sourceFingerprint: "fingerprint",
        },
        auditLog: [],
      },
    },
  });
  contentful.getLocalizedEntryField.mockReturnValue({
    schemaVersion: 1,
    type: "territorial-compact",
    classes: [
      {
        id: "registros-de-secas",
        label: "Registros de secas e estiagens",
        color: "#8C2D04",
      },
    ],
    valueConfig: { type: "absolute", unit: "registros" },
    years: { "2024": { imageId: "projects/x/assets/municipios", values: {} } },
  } as unknown as CompactTerritorialAnalysisDataset);
}

describe("buildIndexCatalogReportPreview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("monta o relatório de Campina Grande no período mais recente", async () => {
    stubDraft();
    stubGeeRow();

    const preview = await buildIndexCatalogReportPreview("panel");

    expect(preview.municipality).toEqual({
      code: CAMPINA_GRANDE,
      name: "Campina Grande",
      uf: "PB",
    });
    expect(preview.period).toBe("2024");
    expect(preview.report.analyses[0]?.snapshot?.dominantClass?.label).toBe(
      "Semiárido",
    );
  });

  it("cobre a série inteira e leva os períodos publicados em cada leitura", async () => {
    stubDraft();
    stubGeeRow();

    const preview = await buildIndexCatalogReportPreview("panel");

    // A série é o que o gráfico do relatório desenha; os períodos publicados
    // vão junto para o repositório trazer todas as linhas numa ida ao Earth
    // Engine e servir as demais do cache.
    expect(
      preview.report.analyses[0]?.timeSeries.map((item) => item.period),
    ).toEqual(["2023", "2024"]);
    expect(gee.getGeeStatisticsYearPatch).toHaveBeenCalledWith(
      "indice-de-aridez-catalogo",
      "2024",
      CAMPINA_GRANDE,
      2,
      source,
      ["2023", "2024"],
    );
    expect(gee.getGeeStatisticsYearPatch).toHaveBeenCalledWith(
      "indice-de-aridez-catalogo",
      "2023",
      CAMPINA_GRANDE,
      2,
      source,
      ["2023", "2024"],
    );
  });

  it("troca as variáveis do texto do catálogo pelos dados do município", async () => {
    stubDraft({
      sections: [
        {
          title: "Situação atual",
          text: "Em [municipio] — [uf], predomina [classe] com [percentual]% em [periodo_extenso].",
        },
      ],
    });
    stubGeeRow();

    const preview = await buildIndexCatalogReportPreview("panel");

    expect(preview.docsContent["indice-de-aridez-catalogo"][0].text).toBe(
      "Em Campina Grande — PB, predomina Semiárido com 83,4% em 2024.",
    );
  });

  it("leva a cor e a nota escritas no catálogo para a prévia", async () => {
    stubDraft({
      sections: [],
      sectionColor: "#795548",
      methodology: "Razão entre precipitação e evapotranspiração.",
    });
    stubGeeRow();

    const preview = await buildIndexCatalogReportPreview("panel");

    expect(preview.report.analyses[0]?.presentation).toEqual({
      sectionColor: "#795548",
      methodology: "Razão entre precipitação e evapotranspiração.",
    });
  });

  it("marca a análise como indisponível quando o município não tem linha", async () => {
    stubDraft();
    gee.getGeeStatisticsYearPatch.mockResolvedValue(null);

    const preview = await buildIndexCatalogReportPreview("panel");

    expect(preview.report.analyses[0]?.status).toBe("unavailable");
  });

  it("pede uma classe só num índice de valor único, e não as faixas do mapa", async () => {
    // Regressão: a prévia do relatório passava `config.classes.length`, que numa
    // tabela de valor único são as faixas de cor do mapa. O repositório recusava
    // com "a camada possui 3 classes, mas uma tabela municipal de valor único
    // produz uma só" e a seção aparecia como indisponível, sem erro na tela.
    stubValueTableDraft();
    gee.getGeeStatisticsYearPatch.mockResolvedValue({
      assetId: "projects/x/assets/municipios",
      featureCount: 1,
      omittedZeroValueLocationKeys: [],
      metrics: {},
      patch: { years: { "2024": { values: { [CAMPINA_GRANDE]: [34] } } } },
    });

    const preview = await buildIndexCatalogReportPreview("panel");

    expect(gee.getGeeStatisticsYearPatch).toHaveBeenCalledWith(
      "registros-de-secas",
      "2024",
      CAMPINA_GRANDE,
      1,
      valueTableSource,
      ["2024"],
    );
    expect(preview.report.analyses[0]?.status).toBe("available");
  });

  it("monta a prévia no período padrão, e não sempre no último", async () => {
    // Numa previsão o padrão é o primeiro período — o mês mais próximo. A
    // prévia pegava o último da lista, ou seja, o horizonte mais distante.
    stubDraft(undefined, "2023");
    stubGeeRow();

    const preview = await buildIndexCatalogReportPreview("panel");

    expect(preview.period).toBe("2023");
    expect(preview.report.analyses[0]?.effectivePeriod).toBe("2023");
  });

  it("não vai ao Earth Engine com um rascunho sem prévia validada", async () => {
    const entry = { sys: { id: "panel", version: 1 }, fields: {} };
    contentful.getCatalogEntry.mockResolvedValue({
      entry,
      locale: "en-US",
      item: {
        entryId: "panel",
        published: false,
        catalogConfig: {
          schemaVersion: 2 as const,
          panelLayerId: "sem-previa",
          status: "draft" as const,
          name: "Sem prévia",
          description: "Teste",
          category: "Dados Climáticos" as const,
          statisticsSource: source,
          classes: [],
          earthEngine: {
            strategy: "single" as const,
            sourceType: "image" as const,
            singleAssetId: "projects/x/assets/map",
          },
          createdBy: { uid: "u", email: "e", at: "2026-01-01T00:00:00.000Z" },
          updatedBy: { uid: "u", email: "e", at: "2026-01-01T00:00:00.000Z" },
          auditLog: [],
        },
      },
    });

    await expect(buildIndexCatalogReportPreview("panel")).rejects.toThrow(
      /Valide os assets/u,
    );
    expect(gee.getGeeStatisticsYearPatch).not.toHaveBeenCalled();
  });
});

describe("buildIndexCatalogReportPreview > variáveis oferecidas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lista as variáveis deste índice com o valor de Campina Grande", async () => {
    stubDraft();
    stubGeeRow();

    const { variables } = await buildIndexCatalogReportPreview("panel");
    const municipio = variables.find((entry) => entry.token === "[municipio]");

    expect(municipio?.example).toBe("Campina Grande");
    expect(variables.map(({ token }) => token)).toContain("[classe_anterior]");
  });

  it("não oferece a janela de 12 meses a um índice anual", async () => {
    stubDraft();
    stubGeeRow();

    const { variables } = await buildIndexCatalogReportPreview("panel");

    expect(variables.map(({ token }) => token)).not.toContain(
      "[janela_12_meses]",
    );
  });

  it("só oferece a tendência depois que a ordem de gravidade é declarada", async () => {
    stubDraft({
      sections: [],
      severity: { order: ["semiarido", "arido"], neutralClassId: "semiarido" },
    });
    stubGeeRow();

    const { variables } = await buildIndexCatalogReportPreview("panel");

    expect(variables.map(({ token }) => token)).toContain("[status_tendencia]");
  });
});
