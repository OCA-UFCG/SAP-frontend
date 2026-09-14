import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { buildMunicipalReport } from "@/services/municipalReportService";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";

const imageData: CompactTerritorialAnalysisDataset = {
  schemaVersion: 1,
  type: "territorial-compact",
  classes: [{ id: "seca", label: "Seca", color: "#f00" }],
  years: { "2024": { imageId: "x", values: { "5200050": [100] } } },
};

describe("buildMunicipalReport", () => {
  it("uses one municipality-series shard and never enters the temporal partition fallback", async () => {
    const loadImageData = vi.fn();
    const loadReportSeries = vi.fn(async () => ({
      municipality: {
        "2024-01": { values: [10] },
        "2024-03": { values: [30] },
      },
    }));
    const report = await buildMunicipalReport("5200050", "2024-02", {
      layers: [{
        panelLayerId: "cdi",
        alias: "cdi",
        title: "CDI",
        order: 1,
        reportSeriesConfig: {
          schemaVersion: 1,
          datasetVersion: "v1",
          shardCount: 64,
          shardStrategy: "ibge-modulo",
          firstPeriod: "2024-01",
          lastPeriod: "2024-03",
        },
        baseImageData: imageData,
      }],
      loadImageData,
      loadReportSeries,
    });

    expect(loadReportSeries).toHaveBeenCalledTimes(1);
    expect(loadImageData).not.toHaveBeenCalled();
    expect(report.analyses[0]).toMatchObject({
      status: "available",
      requestedPeriod: "2024-02",
      effectivePeriod: "2024-01",
    });
    expect(report.analyses[0]?.timeSeries).toHaveLength(2);
  });

  it("discovers every platform layer instead of limiting the report to the configured overrides", async () => {
    const report = await buildMunicipalReport("5200050", "2024", {
      listPanelLayers: async () =>
        [
          { id: "indice-novo", name: "Índice Novo", panelPosition: 30 },
          { id: "anaseca", name: "Monitor de Secas", panelPosition: 10 },
          { id: "outra-camada", name: "Outra Camada", panelPosition: 20 },
        ] as never,
      loadImageData: async () => ({ found: true, imageData, status: "hit" }),
    });

    expect(report.analyses.map(({ id }) => id)).toEqual([
      "anaseca",
      "outra-camada",
      "indice-novo",
    ]);
    expect(report.analyses.map(({ title }) => title)).toEqual([
      "Monitor de Secas",
      "Outra Camada",
      "Índice Novo",
    ]);
    expect(report.templateVariables.classe_indice_novo).toBe("Seca");
    expect(report.templateVariables.classe_outra_camada).toBe("Seca");
  });

  it("leva a categoria do panelLayer para a análise, inclusive quando ela fica indisponível", async () => {
    const report = await buildMunicipalReport("5200050", "2024", {
      listPanelLayers: async () =>
        [
          {
            id: "anaseca",
            name: "Monitor de Secas",
            category: "Dados Climáticos",
            panelPosition: 10,
          },
          {
            id: "sem-dados",
            name: "Camada Sem Dados",
            category: "Dados Ambientais",
            panelPosition: 20,
          },
          { id: "sem-categoria", name: "Camada Legada", panelPosition: 30 },
        ] as never,
      loadImageData: async (panelLayerId: string) =>
        panelLayerId === "sem-dados"
          ? { found: false, status: "miss" }
          : { found: true, imageData, status: "hit" },
    });

    const byId = new Map(report.analyses.map((item) => [item.id, item]));

    expect(byId.get("anaseca")?.category).toBe("Dados Climáticos");
    expect(byId.get("sem-dados")?.status).toBe("unavailable");
    expect(byId.get("sem-dados")?.category).toBe("Dados Ambientais");
    expect(byId.get("sem-categoria")?.category).toBeUndefined();
  });

  it("keeps configured order, partial failures and stable template variables", async () => {
    const report = await buildMunicipalReport("5200050", "2024", {
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      layers: [
        {
          panelLayerId: "missing",
          alias: "missing",
          title: "Missing",
          order: 20,
        },
        { panelLayerId: "seca", alias: "seca", title: "Seca", order: 10 },
      ],
      loadImageData: async (id) => ({
        found: id === "seca",
        imageData: id === "seca" ? imageData : null,
        status: "miss",
      }),
    });
    expect(report.analyses.map((item) => item.id)).toEqual(["seca", "missing"]);
    expect(report.analyses.map((item) => item.status)).toEqual([
      "available",
      "unavailable",
    ]);
    expect(report.templateVariables).toMatchObject({
      municipio: "Abadia de Goiás",
      uf: "GO",
      classe_seca: "Seca",
      percentual_seca: 100,
    });
  });

  it("loads only requested analyses for focused consumers such as chart rendering", async () => {
    const loadImageData = vi.fn(async () => ({
      found: true,
      imageData,
      status: "hit" as const,
    }));
    const report = await buildMunicipalReport("5200050", "2024", {
      layers: [
        { panelLayerId: "seca", alias: "seca", title: "Seca", order: 10 },
        { panelLayerId: "aridez", alias: "aridez", title: "Aridez", order: 20 },
      ],
      analysisIds: ["seca"],
      loadImageData,
    });

    expect(report.analyses.map(({ id }) => id)).toEqual(["seca"]);
    expect(loadImageData).toHaveBeenCalledTimes(1);
    expect(loadImageData).toHaveBeenCalledWith("seca", "2024", undefined);
  });

  it("keeps selected analyses in the checkbox request order", async () => {
    const report = await buildMunicipalReport("5200050", "2024", {
      layers: [
        { panelLayerId: "seca", alias: "seca", title: "Seca", order: 10 },
        { panelLayerId: "aridez", alias: "aridez", title: "Aridez", order: 20 },
        { panelLayerId: "pobreza", alias: "pobreza", title: "Pobreza", order: 30 },
      ],
      analysisIds: ["pobreza", "seca", "aridez"],
      loadImageData: async () => ({ found: true, imageData, status: "hit" }),
    });

    expect(report.analyses.map(({ id }) => id)).toEqual([
      "pobreza",
      "seca",
      "aridez",
    ]);
  });

  it("preserves absolute value semantics from the monitoring dataset", async () => {
    const report = await buildMunicipalReport("5200050", "2024", {
      layers: [
        {
          panelLayerId: "registros",
          alias: "registros",
          title: "Registros",
          order: 1,
        },
      ],
      loadImageData: async () => ({
        found: true,
        status: "hit",
        imageData: {
          ...imageData,
          valueConfig: { type: "absolute", unit: "registros" },
        },
      }),
    });

    expect(report.analyses[0]).toMatchObject({
      valueType: "absolute",
      unit: "registros",
    });
    expect(report.templateVariables).toMatchObject({
      valor_registros: 100,
      unidade_registros: "registros",
      valor_com_unidade_registros: "100 registros",
    });
  });

  it("builds the S2ID annual series from municipal totals, not national ones", async () => {
    // Each annual partition carries both the national aggregate row ("br") and
    // the municipal row. The municipal report must only ever plot the latter.
    const publishedSeries = [
      ["2004", 742], ["2005", 1569], ["2006", 888], ["2007", 1121],
      ["2008", 1000], ["2009", 608], ["2013", 3275], ["2015", 2114],
      ["2017", 2760], ["2018", 2461], ["2019", 2220], ["2020", 2604],
      ["2021", 2753], ["2022", 2270], ["2023", 2414], ["2024", 2004],
      ["2025", 2780],
    ] as const;
    const municipalSeries = publishedSeries.map(
      ([period], index) => [period, index % 4] as const,
    );
    const years = Object.fromEntries(publishedSeries.map(([period]) => [period, {
      imageId: `s2id-${period}`,
      values: {},
    }]));
    const loadImageData = vi.fn(async (_id: string, period?: string) => ({
      found: true,
      status: "hit" as const,
      imageData: {
        schemaVersion: 1,
        type: "territorial-compact" as const,
        valueConfig: { type: "absolute" as const, unit: "registros" },
        classes: [{ id: "registros", label: "Registros", color: "#8c2d04" }],
        years: Object.fromEntries(Object.entries(years).map(([year, data]) => [
          year,
          {
            ...data,
            values: year === period
              ? {
                  br: [publishedSeries.find(([key]) => key === year)?.[1] ?? 0],
                  "5200050": [
                    municipalSeries.find(([key]) => key === year)?.[1] ?? 0,
                  ],
                }
              : {},
          },
        ])),
      },
    }));

    const report = await buildMunicipalReport("5200050", "2024", {
      layers: [{
        panelLayerId: "s2id_secas_estiagens",
        alias: "s2id",
        title: "S2ID",
        order: 1,
        periods: publishedSeries.map(([period]) => period),
      }],
      loadImageData,
    });

    expect(report.analyses[0]?.timeSeries.map(({ period, distribution }) => [
      period,
      distribution[0]?.percentage,
    ])).toEqual(municipalSeries.map(([period, value]) => [period, value]));
    expect(report.analyses[0]?.snapshot?.distribution[0]?.percentage).toBe(
      municipalSeries.find(([period]) => period === "2024")?.[1],
    );
    expect(loadImageData).toHaveBeenCalledTimes(publishedSeries.length);
    expect(loadImageData).not.toHaveBeenCalledWith("s2id_secas_estiagens");
  });

  it("plots the municipal shard series and never requests the national aggregate", async () => {
    const loadReportSeries = vi.fn(async () => ({
      municipality: { "2024": { values: [3] }, "2025": { values: [2] } },
    }));
    // Resolved through listPanelLayers so the real src/config/municipalReport
    // override for this layer is applied, exactly as in production.
    const report = await buildMunicipalReport("5200050", "2025", {
      listPanelLayers: async () =>
        [
          {
            id: "s2id_secas_estiagens",
            name: "Registros de Secas e Estiagens (2004-2025)",
            panelPosition: 120,
            reportSeriesConfig: {
              schemaVersion: 1,
              datasetVersion: "v1",
              shardCount: 64,
              shardStrategy: "ibge-modulo",
              firstPeriod: "2024",
              lastPeriod: "2025",
            },
            imageData: {
              ...imageData,
              valueConfig: { type: "absolute", unit: "registros" },
              years: {
                "2024": { imageId: "a", values: {} },
                "2025": { imageId: "b", values: {} },
              },
            },
          },
        ] as never,
      loadReportSeries,
      loadImageData: vi.fn(),
    });

    expect(loadReportSeries).toHaveBeenCalledWith(
      "s2id_secas_estiagens",
      "5200050",
      expect.objectContaining({ datasetVersion: "v1" }),
    );
    expect(report.analyses[0]?.timeSeries.map(({ period, distribution }) => [
      period,
      distribution[0]?.percentage,
    ])).toEqual([
      ["2024", 3],
      ["2025", 2],
    ]);
    expect(report.analyses[0]?.snapshot?.distribution[0]?.percentage).toBe(2);
  });

  it("uses the nearest future snapshot when no previous period exists", async () => {
    const report = await buildMunicipalReport("5200050", "2023", {
      layers: [
        { panelLayerId: "seca", alias: "seca", title: "Seca", order: 1 },
      ],
      loadImageData: async () => ({ found: true, imageData, status: "hit" }),
    });
    expect(report.analyses[0]).toMatchObject({
      status: "available",
      requestedPeriod: "2023",
      effectivePeriod: "2024",
    });
    expect(report.analyses[0]?.timeSeries).toHaveLength(1);
  });

  it("uses the nearest previous indexed period while preserving the requested period", async () => {
    const loadImageData = vi.fn(async () => ({
      found: true,
      imageData,
      status: "hit" as const,
    }));
    const report = await buildMunicipalReport("5200050", "2025", {
      layers: [
        { panelLayerId: "seca", alias: "seca", title: "Seca", order: 1 },
      ],
      availabilityIndex: {
        schemaVersion: 1,
        generatedAt: "2026-01-01T00:00:00.000Z",
        layers: [{ panelLayerId: "seca", order: 0, periods: ["2024"] }],
        byMunicipality: { "5200050": { seca: "0" } },
      },
      loadImageData,
    });

    expect(loadImageData).toHaveBeenCalledWith("seca", "2024", undefined);
    expect(report.requestedPeriod).toBe("2025");
    expect(report.analyses[0]).toMatchObject({
      status: "available",
      requestedPeriod: "2025",
      effectivePeriod: "2024",
    });
    expect(report.templateVariables.periodo_seca).toBe("2024");
  });

  it("uses the latest available month when an annual period is requested", async () => {
    const monthlyImageData: CompactTerritorialAnalysisDataset = {
      ...imageData,
      years: {
        "2026-01": { imageId: "jan", values: { "5200050": [90] } },
        "2026-04": { imageId: "apr", values: { "5200050": [100] } },
        "2025-12": { imageId: "dec", values: { "5200050": [100] } },
      },
    };
    const report = await buildMunicipalReport("5200050", "2026", {
      layers: [
        { panelLayerId: "seca", alias: "seca", title: "Seca", order: 1 },
      ],
      loadImageData: async () => ({
        found: true,
        imageData: monthlyImageData,
        status: "hit",
      }),
    });

    expect(report.analyses[0]).toMatchObject({
      status: "available",
      requestedPeriod: "2026",
      effectivePeriod: "2026-04",
    });
    expect(report.templateVariables.periodo_seca).toBe("2026-04");
  });

  it.each([
    {
      title: "Cobertura da Terra",
      panelLayerId: "terraibge-test",
      alias: "cobertura_terra",
      sourcePeriod: "2020-01",
      spatialPeriod: "2020",
    },
    {
      title: "Produção Primária Bruta",
      panelLayerId: "prodprimariabruta-test",
      alias: "producao_primaria_bruta",
      sourcePeriod: "2025-01",
      spatialPeriod: "2025",
    },
  ])("normalizes $title to its matching spatial year", async ({
    title,
    panelLayerId,
    alias,
    sourcePeriod,
    spatialPeriod,
  }) => {
    const annualMapData: CompactTerritorialAnalysisDataset = {
      ...imageData,
      years: {
        [spatialPeriod]: { imageId: "annual-map", values: {} },
      },
    };
    const report = await buildMunicipalReport("5200050", "2026", {
      layers: [{
        panelLayerId,
        alias,
        title,
        order: 1,
        reportSeriesConfig: {
          schemaVersion: 1,
          datasetVersion: "v1",
          shardCount: 64,
          shardStrategy: "ibge-modulo",
          firstPeriod: sourcePeriod,
          lastPeriod: sourcePeriod,
        },
        baseImageData: annualMapData,
      }],
      loadReportSeries: async () => ({
        municipality: { [sourcePeriod]: { values: [100] } },
      }),
    });

    expect(report.analyses[0]).toMatchObject({
      status: "available",
      requestedPeriod: "2026",
      effectivePeriod: spatialPeriod,
      snapshot: { period: spatialPeriod, label: spatialPeriod },
    });
    expect(report.analyses[0]?.timeSeries.map(({ period }) => period)).toEqual([
      spatialPeriod,
    ]);
    expect(report.templateVariables[`periodo_${alias}`]).toBe(spatialPeriod);
  });

  it("preserves annual periods that already match the spatial layer", async () => {
    const annualMapData: CompactTerritorialAnalysisDataset = {
      ...imageData,
      years: {
        "2025": { imageId: "annual-map", values: {} },
      },
    };
    const report = await buildMunicipalReport("5200050", "2026", {
      layers: [{
        panelLayerId: "pob_urb-test",
        alias: "pobreza_urbana",
        title: "Pobreza urbana",
        order: 1,
        reportSeriesConfig: {
          schemaVersion: 1,
          datasetVersion: "v1",
          shardCount: 64,
          shardStrategy: "ibge-modulo",
          firstPeriod: "2025",
          lastPeriod: "2025",
        },
        baseImageData: annualMapData,
      }],
      loadReportSeries: async () => ({
        municipality: { "2025": { values: [100] } },
      }),
    });

    expect(report.analyses[0]).toMatchObject({
      effectivePeriod: "2025",
      snapshot: { period: "2025", label: "2025" },
    });
    expect(report.analyses[0]?.timeSeries.map(({ period }) => period)).toEqual([
      "2025",
    ]);
  });

  it("does not guess a spatial period when a calendar year is ambiguous", async () => {
    const ambiguousMapData: CompactTerritorialAnalysisDataset = {
      ...imageData,
      years: {
        "2020-01": { imageId: "jan", values: {} },
        "2020-12": { imageId: "dec", values: {} },
      },
    };
    const report = await buildMunicipalReport("5200050", "2020", {
      layers: [{
        panelLayerId: "ambiguous-test",
        alias: "ambiguous",
        title: "Ambiguous",
        order: 1,
        reportSeriesConfig: {
          schemaVersion: 1,
          datasetVersion: "v1",
          shardCount: 64,
          shardStrategy: "ibge-modulo",
          firstPeriod: "2020",
          lastPeriod: "2020",
        },
        baseImageData: ambiguousMapData,
      }],
      loadReportSeries: async () => ({
        municipality: { "2020": { values: [100] } },
      }),
    });

    expect(report.analyses[0]).toMatchObject({
      effectivePeriod: "2020",
      snapshot: { period: "2020", label: "2020" },
    });
  });
  // Regressão da integração catálogo -> Relatório Automático: um índice
  // publicado pelo catálogo entrava no relatório como `period_not_found`
  // silencioso, porque `loadImageData` era chamado sem território e o Earth
  // Engine só é consultado quando `locationKey` está presente.
  describe("camadas com fonte estatística no Earth Engine", () => {
    const catalogImageData: CompactTerritorialAnalysisDataset = {
      schemaVersion: 1,
      type: "territorial-compact",
      classes: [
        { id: "baixo", label: "Baixo", color: "#0f0" },
        { id: "alto", label: "Alto", color: "#f00" },
      ],
      years: {
        "2023": { imageId: "a/2023", values: {} },
        "2024": { imageId: "a/2024", values: {} },
      },
    };

    const statisticsSource = {
      schemaVersion: 1,
      sourceRevision: "rev-1",
    } as never;

    function withMunicipalValues(period: string, values: number[]) {
      return {
        ...catalogImageData,
        years: {
          ...catalogImageData.years,
          [period]: { imageId: `a/${period}`, values: { "5200050": values } },
        },
      };
    }

    it("passa o código do município como território para a camada do catálogo", async () => {
      const loadImageData = vi.fn(async (_id: string, period?: string) => ({
        found: true,
        imageData: withMunicipalValues(period ?? "2024", period === "2023" ? [70, 30] : [40, 60]),
        status: "hit" as const,
      }));

      const report = await buildMunicipalReport("5200050", "2024", {
        layers: [{
          panelLayerId: "indice-catalogo",
          alias: "indice_catalogo",
          title: "Índice do Catálogo",
          order: 1,
          periods: ["2023", "2024"],
          statisticsSource,
          baseImageData: catalogImageData,
        }],
        loadImageData,
      });

      for (const call of loadImageData.mock.calls) {
        expect(call[2]).toBe("5200050");
      }
      expect(report.analyses[0]).toMatchObject({
        status: "available",
        effectivePeriod: "2024",
      });
      expect(report.analyses[0]?.snapshot?.dominantClass?.label).toBe("Alto");
      expect(report.analyses[0]?.timeSeries).toHaveLength(2);
    });

    it("leva a cor e a nota escritas no catálogo para o relatório", async () => {
      const report = await buildMunicipalReport("5200050", "2024", {
        listPanelLayers: async () =>
          [
            {
              id: "indice-catalogo",
              name: "Índice do Catálogo",
              panelPosition: 10,
              imageData: catalogImageData,
              statisticsSource,
              reportConfig: {
                schemaVersion: 1,
                sectionColor: "#795548",
                methodology: "Produzido a partir de dados do satélite X.",
                sections: [{ title: "Situação atual", text: "Texto." }],
              },
            },
          ] as never,
        loadImageData: async (_id: string, period?: string) => ({
          found: true,
          imageData: withMunicipalValues(period ?? "2024", [40, 60]),
          status: "hit" as const,
        }),
      });

      expect(report.analyses[0]?.presentation).toEqual({
        sectionColor: "#795548",
        methodology: "Produzido a partir de dados do satélite X.",
      });
    });

    it("não inventa apresentação para uma camada sem texto no catálogo", async () => {
      const report = await buildMunicipalReport("5200050", "2024", {
        listPanelLayers: async () =>
          [
            {
              id: "indice-catalogo",
              name: "Índice do Catálogo",
              panelPosition: 10,
              imageData: catalogImageData,
              statisticsSource,
            },
          ] as never,
        loadImageData: async (_id: string, period?: string) => ({
          found: true,
          imageData: withMunicipalValues(period ?? "2024", [40, 60]),
          status: "hit" as const,
        }),
      });

      expect(report.analyses[0]?.presentation).toBeUndefined();
    });

    it("semeia a série num período publicado quando o pedido não existe na camada", async () => {
      const loadImageData = vi.fn(async (_id: string, period?: string) => ({
        found: true,
        imageData: withMunicipalValues(period ?? "2024", [40, 60]),
        status: "hit" as const,
      }));

      const report = await buildMunicipalReport("5200050", "2026", {
        layers: [{
          panelLayerId: "indice-catalogo",
          alias: "indice_catalogo",
          title: "Índice do Catálogo",
          order: 1,
          periods: ["2023", "2024"],
          statisticsSource,
          baseImageData: catalogImageData,
        }],
        loadImageData,
      });

      expect(loadImageData.mock.calls.map(([, period]) => period)).not.toContain("2026");
      expect(report.analyses[0]).toMatchObject({
        status: "available",
        requestedPeriod: "2026",
        effectivePeriod: "2024",
      });
    });

    it("não gasta a agregação completa do Contentful quando a leitura por período não devolve dados", async () => {
      const loadImageData = vi.fn(async () => ({
        found: false,
        imageData: null,
        status: "miss" as const,
      }));

      const report = await buildMunicipalReport("5200050", "2024", {
        layers: [{
          panelLayerId: "indice-catalogo",
          alias: "indice_catalogo",
          title: "Índice do Catálogo",
          order: 1,
          periods: ["2023", "2024"],
          statisticsSource,
          baseImageData: catalogImageData,
        }],
        loadImageData,
      });

      expect(loadImageData).toHaveBeenCalledTimes(1);
      expect(loadImageData.mock.calls[0]?.[1]).toBe("2024");
      expect(report.analyses[0]?.status).toBe("unavailable");
    });

    it("mantém a camada legada sem território, lendo as partições do Contentful", async () => {
      const loadImageData = vi.fn(async () => ({
        found: true,
        imageData,
        status: "hit" as const,
      }));

      await buildMunicipalReport("5200050", "2024", {
        layers: [{
          panelLayerId: "anaseca",
          alias: "seca",
          title: "Monitor de Secas",
          order: 1,
          periods: ["2024"],
          baseImageData: imageData,
        }],
        loadImageData,
      });

      expect(loadImageData).toHaveBeenCalled();
      for (const call of loadImageData.mock.calls) {
        expect(call[2]).toBeUndefined();
      }
    });
  });
});

const serieDeDuasClasses: CompactTerritorialAnalysisDataset = {
  schemaVersion: 1,
  type: "territorial-compact",
  classes: [
    { id: "sem-seca", label: "Sem seca", color: "#0f0" },
    { id: "seca-fraca", label: "Seca fraca", color: "#ff0" },
  ],
  years: {
    "2023": { imageId: "a", values: { "5200050": [80, 20] } },
    "2024": { imageId: "b", values: { "5200050": [30, 70] } },
  },
};

function camadaComSerie(
  reportSeverity?: import("@/utils/reportVariableProfile").ReportSeveritySpec,
) {
  return {
    layers: [
      {
        panelLayerId: "indice-novo",
        alias: "indice_novo",
        title: "Índice Novo",
        order: 1,
        periods: ["2023", "2024"],
        baseImageData: serieDeDuasClasses,
        ...(reportSeverity ? { reportSeverity } : {}),
      },
    ],
    loadImageData: async () => ({
      found: true,
      imageData: serieDeDuasClasses,
      status: "hit" as const,
    }),
  };
}

describe("buildMunicipalReport > variáveis de série", () => {
  it("descreve o período anterior a partir da série que a análise já carregou", async () => {
    const report = await buildMunicipalReport(
      "5200050",
      "2024",
      camadaComSerie() as never,
    );

    expect(report.templateVariables.classe_anterior_indice_novo).toBe(
      "Sem seca",
    );
    expect(report.templateVariables.percentual_anterior_indice_novo).toBe(80);
    expect(report.templateVariables.quantidade_periodos_indice_novo).toBe(2);
    // A classe atual valia 20% em 2023 e vale 70% em 2024.
    expect(report.templateVariables.variacao_pontos_indice_novo).toBe(50);
  });

  it("só descreve a tendência quando a ordem de gravidade foi declarada", async () => {
    const semOrdem = await buildMunicipalReport(
      "5200050",
      "2024",
      camadaComSerie() as never,
    );
    const comOrdem = await buildMunicipalReport(
      "5200050",
      "2024",
      camadaComSerie({
        order: ["sem-seca", "seca-fraca"],
        neutralClassId: "sem-seca",
      }) as never,
    );

    expect(semOrdem.templateVariables).not.toHaveProperty(
      "status_tendencia_indice_novo",
    );
    expect(comOrdem.templateVariables.status_tendencia_indice_novo).toBe(
      "agravando",
    );
    expect(
      comOrdem.templateVariables.quantidade_periodos_com_fenomeno_indice_novo,
    ).toBe(1);
  });

  it("não pede nenhuma leitura além das que a série do relatório já faz", async () => {
    const dependencies = camadaComSerie();
    const loadImageData = vi.fn(dependencies.loadImageData);
    await buildMunicipalReport("5200050", "2024", {
      ...dependencies,
      loadImageData,
    } as never);

    // Um pedido por período publicado, exatamente como antes das variáveis.
    expect(loadImageData).toHaveBeenCalledTimes(2);
  });
});
