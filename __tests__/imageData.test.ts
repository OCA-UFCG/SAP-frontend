import { describe, expect, it } from "vitest";
import {
  getImageDataLegend,
  keepOnlyCurrentSeasonPeriod,
  keepOnlyFutureForecastPeriods,
  resolveImageCollectionPeriod,
  resolveImageYearEntry,
} from "@/utils/imageData";
import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";

describe("imageData helpers", () => {
  it("uses map visualization legend separately from analysis classes", () => {
    const imageData: CompactTerritorialAnalysisDataset = {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2025",
      classes: [
        {
          id: "populacao-total",
          label: "População total",
          color: "#bd0026",
        },
      ],
      mapVisualization: {
        sourceType: "featureCollection",
        property: "{year}",
        min: 0,
        max: 100,
        palette: ["#ffffcc", "#bd0026"],
        legend: [
          { id: "0-20", label: "0-20", color: "#ffffcc" },
          { id: ">100", label: ">100", color: "#bd0026" },
        ],
      },
      years: {
        "2025": {
          imageId: "projects/example/assets/pob_total",
          year: "2025",
          values: {
            br: [42],
          },
        },
      },
    };

    expect(getImageDataLegend(imageData)).toEqual([
      { color: "#ffffcc", label: "0-20" },
      { color: "#bd0026", label: ">100" },
    ]);
    expect(resolveImageYearEntry(imageData, "2025")).toMatchObject({
      imageParams: [
        { color: "#ffffcc", label: "0-20" },
        { color: "#bd0026", label: ">100" },
      ],
      mapVisualization: {
        property: "2025",
      },
    });
  });

  it("keeps the current and future months for precipitation forecasts", () => {
    const imageData: CompactTerritorialAnalysisDataset = {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2026-10",
      classes: [{ id: "a", label: "Classe A", color: "#111111" }],
      years: {
        "2026-06": { imageId: "img-06", values: {} },
        "2026-07": { imageId: "img-07", values: {} },
        "2026-08": { imageId: "img-08", values: {} },
        "2026-10": { imageId: "img-10", values: {} },
      },
    };

    const filtered = keepOnlyFutureForecastPeriods(
      "prev_anomalia_precipitacao",
      imageData,
      new Date("2026-07-24T12:00:00.000Z"),
    ) as CompactTerritorialAnalysisDataset;

    expect(Object.keys(filtered.years)).toEqual([
      "2026-07",
      "2026-08",
      "2026-10",
    ]);
    expect(filtered.defaultYear).toBe("2026-07");
    expect(filtered).toMatchObject({
      mapVisualization: {
        sourceType: "imageCollection",
        min: 0,
        max: 5,
        outputBand: "Classe_Previsao",
        thresholds: [-90, -30, 0, 30, 90],
        palette: [
          "#a50026",
          "#f46d43",
          "#fee090",
          "#abd9e9",
          "#4575b4",
          "#313695",
        ],
      },
      years: {
        "2026-07": {
          imageId: "projects/ee-ulissesalencar17/assets/CPTEC_Prev_P_Anomalia",
          leadTime: 1,
        },
        "2026-08": {
          imageId: "projects/ee-ulissesalencar17/assets/CPTEC_Prev_P_Anomalia",
          leadTime: 2,
        },
        "2026-10": {
          imageId: "projects/ee-ulissesalencar17/assets/CPTEC_Prev_P_Anomalia",
          leadTime: 3,
        },
      },
    });
  });

  it("does not filter periods from other panel layers", () => {
    const imageData: CompactTerritorialAnalysisDataset = {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2026-07",
      classes: [{ id: "a", label: "Classe A", color: "#111111" }],
      years: {
        "2026-06": { imageId: "img-06", values: {} },
        "2026-07": { imageId: "img-07", values: {} },
      },
    };

    expect(
      keepOnlyFutureForecastPeriods(
        "anaseca",
        imageData,
        new Date(2026, 6, 24),
      ),
    ).toBe(imageData);
  });

  it("preserves legacy lead suffixes when historical emissions overlap", () => {
    const legacyAssetPrefix =
      "projects/ee-ulissesalencar17/assets/previsao_P_cal_";
    const imageData: CompactTerritorialAnalysisDataset = {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2026-11",
      classes: [{ id: "a", label: "Classe A", color: "#111111" }],
      years: {
        "2026-05": { imageId: `${legacyAssetPrefix}20260401_01`, values: {} },
        "2026-06": { imageId: `${legacyAssetPrefix}20260401_02`, values: {} },
        "2026-07": { imageId: `${legacyAssetPrefix}20260601_01`, values: {} },
        "2026-08": { imageId: `${legacyAssetPrefix}20260701_01`, values: {} },
        "2026-09": { imageId: `${legacyAssetPrefix}20260701_02`, values: {} },
        "2026-10": { imageId: `${legacyAssetPrefix}20260701_03`, values: {} },
        "2026-11": { imageId: `${legacyAssetPrefix}20260701_04`, values: {} },
      },
    };

    const filtered = keepOnlyFutureForecastPeriods(
      "prev_anomalia_precipitacao",
      imageData,
      new Date("2026-08-10T12:00:00.000Z"),
    ) as CompactTerritorialAnalysisDataset;

    expect(
      Object.fromEntries(
        Object.entries(filtered.years).map(([month, entry]) => [
          month,
          entry.leadTime,
        ]),
      ),
    ).toEqual({
      "2026-08": 1,
      "2026-09": 2,
      "2026-10": 3,
      "2026-11": 4,
    });
  });

  it("uses the Brazil calendar month at UTC month boundaries", () => {
    const imageData: CompactTerritorialAnalysisDataset = {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2026-09",
      classes: [{ id: "a", label: "Classe A", color: "#111111" }],
      years: {
        "2026-07": { imageId: "img-07", values: {} },
        "2026-08": { imageId: "img-08", values: {} },
        "2026-09": { imageId: "img-09", values: {} },
      },
    };

    const filtered = keepOnlyFutureForecastPeriods(
      "prev_anomalia_precipitacao",
      imageData,
      new Date("2026-08-01T01:00:00.000Z"),
    ) as CompactTerritorialAnalysisDataset;

    expect(Object.keys(filtered.years)).toEqual([
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
  });
});

/**
 * Regressão: os 35 períodos do Índice de Aridez BR-DWGD apontam para a mesma
 * `ImageCollection`, então sem uma janela de tempo o mapa exibia sempre a
 * última imagem empilhada, independente do ano escolhido no painel.
 */
describe("resolveImageCollectionPeriod", () => {
  const baseEntry = {
    default: false,
    imageId:
      "projects/obscaatinga/assets/ColecaoImagens/IA_atlas_BR_DWGD_default_v1",
    imageParams: [],
  };

  it("turns an annual period into the UTC window of that year", () => {
    expect(
      resolveImageCollectionPeriod({ ...baseEntry, year: "1990" }),
    ).toEqual({
      startMillis: Date.UTC(1990, 0, 1),
      endMillis: Date.UTC(1991, 0, 1),
    });
  });

  it("turns a monthly period into the UTC window of that month", () => {
    expect(
      resolveImageCollectionPeriod({ ...baseEntry, year: "2024-12" }),
    ).toEqual({
      startMillis: Date.UTC(2024, 11, 1),
      endMillis: Date.UTC(2025, 0, 1),
    });
  });

  it("adds the configured year label so assets with unreliable dates still work", () => {
    expect(
      resolveImageCollectionPeriod({
        ...baseEntry,
        year: "2000",
        mapVisualization: {
          sourceType: "imageCollection",
          imageCollectionPeriodProperty: "ano",
        },
      }),
    ).toEqual({
      startMillis: Date.UTC(2000, 0, 1),
      endMillis: Date.UTC(2001, 0, 1),
      property: "ano",
      value: "2000",
    });
  });

  it("leaves forecast layers to their own selection", () => {
    expect(
      resolveImageCollectionPeriod({
        ...baseEntry,
        year: "2026-09",
        leadTime: 1,
        mapVisualization: {
          sourceType: "imageCollection",
          imageCollectionSelection: {
            latestProperty: "data_emissao",
            latestValue: 20260801,
            filterProperty: "lead_time",
          },
        },
      }),
    ).toBeUndefined();
  });

  it("ignores period keys that are not datable", () => {
    expect(
      resolveImageCollectionPeriod({ ...baseEntry, year: "general" }),
    ).toBeUndefined();
    expect(resolveImageCollectionPeriod(baseEntry)).toBeUndefined();
    expect(
      resolveImageCollectionPeriod({ ...baseEntry, year: "2024-13" }),
    ).toBeUndefined();
  });

  it("keeps a single option for seasonal layers", () => {
    const imageData: CompactTerritorialAnalysisDataset = {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2026-06",
      classes: [{ id: "a", label: "Classe A", color: "#111111" }],
      years: {
        "2026-06": { imageId: "img-jja", values: {} },
        "2026-09": { imageId: "img-son", values: {} },
        "2026-10": { imageId: "img-ond", values: {} },
      },
    };

    const filtered = keepOnlyCurrentSeasonPeriod(
      imageData,
      true,
      new Date("2026-09-17T12:00:00.000Z"),
    ) as CompactTerritorialAnalysisDataset;

    expect(Object.keys(filtered.years)).toEqual(["2026-09"]);
    expect(filtered.defaultYear).toBe("2026-09");
  });

  it("leaves non-seasonal layers untouched", () => {
    const imageData: CompactTerritorialAnalysisDataset = {
      schemaVersion: 1,
      type: "territorial-compact",
      defaultYear: "2025",
      classes: [{ id: "a", label: "Classe A", color: "#111111" }],
      years: {
        "2024": { imageId: "img-2024", values: {} },
        "2025": { imageId: "img-2025", values: {} },
      },
    };

    expect(keepOnlyCurrentSeasonPeriod(imageData, false)).toBe(imageData);
    expect(keepOnlyCurrentSeasonPeriod(imageData, true)).toBe(imageData);
  });
});