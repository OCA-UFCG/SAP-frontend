import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@google/earthengine", () => ({ default: {} }));

const mocks = vi.hoisted(() => ({
  discoverMunicipalValueTable: vi.fn(),
  validateMapAssets: vi.fn(),
}));

vi.mock("@/services/indexCatalog/municipalValueTableBuild", () => ({
  discoverMunicipalValueTable: mocks.discoverMunicipalValueTable,
}));
vi.mock("@/services/indexCatalog/mapAssetValidation", () => ({
  validateMapAssets: mocks.validateMapAssets,
}));

import type { GeeMunicipalValueTableStatisticsSource } from "@/contracts/geeMunicipalValueTable";
import {
  buildMunicipalValueTableDraft,
  buildValueTemplates,
} from "@/services/indexCatalog/municipalValueTableDraft";
import type { IndexCatalogConfigV2 } from "@/types/indexCatalog";

const ASSET_ID = "projects/example/assets/s2id";

const statisticsSource: GeeMunicipalValueTableStatisticsSource = {
  kind: "gee-municipal-value-table",
  asset: { type: "fixed", assetId: ASSET_ID },
  periodGranularity: "year",
  valueProperty: "{year}",
  aggregation: "sum",
  properties: {
    municipalityCode: "CD_MUN",
    locationName: "NM_MUN",
    stateCode: "SIGLA_UF",
  },
};

function buildConfig(
  overrides: Partial<IndexCatalogConfigV2> = {},
): IndexCatalogConfigV2 {
  return {
    schemaVersion: 2,
    panelLayerId: "registros-de-secas",
    status: "draft",
    name: "Registros de Secas e Estiagens",
    description: "Quantidade anual de registros municipais.",
    category: "Dados Socioeconômicos",
    statisticsSource,
    valueIndicator: {
      label: "Registros de secas e estiagens",
      color: "#8C2D04",
      measurementUnit: "registros",
      valueType: "absolute",
    },
    classes: [
      { classIndex: 0, id: "0-6", label: "0 a 6", color: "#FEE5D9" },
      { classIndex: 1, id: "6-12", label: "> 6 a 12", color: "#FCAE91" },
      { classIndex: 2, id: "12-18", label: "> 12 a 18", color: "#FB6A4A" },
    ],
    earthEngine: {
      strategy: "single",
      sourceType: "featureCollection",
      singleAssetId: ASSET_ID,
      property: "{year}",
      thresholds: [6, 12],
    },
    createdBy: { uid: "u", email: null, at: "2026-01-01T00:00:00.000Z" },
    updatedBy: { uid: "u", email: null, at: "2026-01-01T00:00:00.000Z" },
    ...overrides,
  } as IndexCatalogConfigV2;
}

beforeEach(() => {
  mocks.discoverMunicipalValueTable.mockReset();
  mocks.validateMapAssets.mockReset();
  mocks.discoverMunicipalValueTable.mockResolvedValue({
    assets: [
      {
        assetId: ASSET_ID,
        updateTime: "2026-01-01T00:00:00Z",
        columns: [
          { periodKey: "2024", column: "2024" },
          { periodKey: "2025", column: "2025" },
        ],
        municipalityCount: 5571,
      },
    ],
    periods: ["2024", "2025"],
    municipalityCount: 5571,
  });
  mocks.validateMapAssets.mockResolvedValue({
    assets: [{ assetId: ASSET_ID, updateTime: "2026-01-01T00:00:00Z" }],
  });
});

describe("buildValueTemplates", () => {
  it("glues a percentage to the number and separates any other unit", () => {
    expect(
      buildValueTemplates({
        label: "Percentual de pobreza",
        color: "#BD0026",
        measurementUnit: "%",
        valueType: "percentage",
      }).state,
    ).toBe("Percentual de pobreza em {name}: {value}%.");
    expect(
      buildValueTemplates({
        label: "Registros",
        color: "#8C2D04",
        measurementUnit: "registros",
        valueType: "absolute",
      }).state,
    ).toBe("Registros em {name}: {value} registros.");
  });
});

describe("buildMunicipalValueTableDraft", () => {
  it("publishes one statistic class and keeps the ranges in the map legend", async () => {
    const build = await buildMunicipalValueTableDraft(
      buildConfig(),
      statisticsSource,
    );

    expect(build.panelLayerImageData.classes).toEqual([
      {
        id: "registros-de-secas",
        label: "Registros de secas e estiagens",
        color: "#8C2D04",
      },
    ]);
    expect(build.mapVisualization.legend?.map((entry) => entry.label)).toEqual([
      "0 a 6",
      "> 6 a 12",
      "> 12 a 18",
    ]);
    expect(build.mapVisualization).toMatchObject({
      sourceType: "featureCollection",
      property: "{year}",
      min: 0,
      max: 2,
      thresholds: [6, 12],
    });
  });

  it("carries the unit and the number format to the panel", async () => {
    const build = await buildMunicipalValueTableDraft(
      buildConfig(),
      statisticsSource,
    );

    expect(build.panelLayerImageData.valueConfig).toEqual({
      type: "absolute",
      unit: "registros",
      distributionTitle: "Registros de secas e estiagens",
    });
    expect(build.panelLayerImageData.templates?.municipality).toContain(
      "{value} registros",
    );
  });

  it("leaves the territorial values out of the published imageData", async () => {
    const build = await buildMunicipalValueTableDraft(
      buildConfig(),
      statisticsSource,
    );

    expect(Object.keys(build.panelLayerImageData.years)).toEqual([
      "2024",
      "2025",
    ]);
    expect(build.panelLayerImageData.years["2025"].values).toEqual({});
    expect(build.panelLayerImageData.defaultYear).toBe("2025");
    expect(build.statisticsSource.sourceRevision).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("warns that region, biome, ASD and semiarid stay empty", async () => {
    const build = await buildMunicipalValueTableDraft(
      buildConfig(),
      statisticsSource,
    );

    expect(build.validation.warnings[0].message).toContain("semiárido");
    expect(build.validation.warnings[0].message).toContain("soma");
  });

  it("requires one threshold fewer than the number of ranges", async () => {
    await expect(
      buildMunicipalValueTableDraft(
        buildConfig({
          earthEngine: {
            strategy: "single",
            sourceType: "featureCollection",
            singleAssetId: ASSET_ID,
            property: "{year}",
            thresholds: [6],
          },
        }),
        statisticsSource,
      ),
    ).rejects.toThrow("exatamente 2 limite(s)");
  });

  it("refuses to build without the indicator", async () => {
    await expect(
      buildMunicipalValueTableDraft(
        buildConfig({ valueIndicator: undefined }),
        statisticsSource,
      ),
    ).rejects.toThrow("Descreva o indicador");
  });
});
