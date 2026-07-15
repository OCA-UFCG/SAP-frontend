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
      aggregate: null,
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
    expect(loadImageData).toHaveBeenCalledWith("seca", "2024");
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

  it("builds the published S2ID series from annual partitions like Monitoramento", async () => {
    const publishedSeries = [
      ["2004", 742], ["2005", 1569], ["2006", 888], ["2007", 1121],
      ["2008", 1000], ["2009", 608], ["2013", 3275], ["2015", 2114],
      ["2017", 2760], ["2018", 2461], ["2019", 2220], ["2020", 2604],
      ["2021", 2753], ["2022", 2270], ["2023", 2414], ["2024", 2004],
      ["2025", 2780],
    ] as const;
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
                  "5200050": [year === "2024" ? 1 : 0],
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
        timeSeriesLocationKey: "br",
      }],
      loadImageData,
    });

    expect(report.analyses[0]?.timeSeries.map(({ period, distribution }) => [
      period,
      distribution[0]?.percentage,
    ])).toEqual(publishedSeries);
    expect(report.analyses[0]?.snapshot?.distribution[0]?.percentage).toBe(1);
    expect(loadImageData).toHaveBeenCalledTimes(publishedSeries.length);
    expect(loadImageData).not.toHaveBeenCalledWith("s2id_secas_estiagens");
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

    expect(loadImageData).toHaveBeenCalledWith("seca", "2024");
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
});
