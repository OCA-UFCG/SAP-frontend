import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  inspectEarthEngineAsset: vi.fn(),
  listEarthEngineAssets: vi.fn(),
  initializeGee: vi.fn(),
  evaluateGeeObject: vi.fn(),
}));

type Expression = { tag: string; assetId: string; level?: string };

interface MockCollection {
  aggregate_array: () => { distinct: () => Expression };
  filter: (filter: { tag?: string; value?: string }) => MockCollection;
  distinct: () => { size: () => Expression };
  size: () => Expression;
  map: () => { aggregate_sum: () => Expression };
}

function collection(assetId: string, level?: string): MockCollection {
  return {
    aggregate_array: () => ({
      distinct: () => ({ tag: "periods", assetId }) satisfies Expression,
    }),
    filter: (filter: { tag?: string; value?: string }) =>
      collection(
        assetId,
        filter.tag === "level"
          ? filter.value
          : level
            ? `${level}-complete`
            : "complete",
      ),
    distinct: () => ({
      size: () => ({ tag: "distinct", assetId }) satisfies Expression,
    }),
    size: () => ({ tag: "size", assetId, level }) satisfies Expression,
    map: () => ({
      aggregate_sum: () => ({ tag: "invalid", assetId }) satisfies Expression,
    }),
  };
}

vi.mock("@google/earthengine", () => ({
  default: {
    FeatureCollection: (assetId: string) => collection(assetId),
    Filter: {
      notNull: () => ({ tag: "not-null" }),
      eq: (_property: string, value: string) => ({ tag: "level", value }),
    },
  },
}));
vi.mock("@/app/api/ee/services", () => ({
  inspectEarthEngineAsset: mocks.inspectEarthEngineAsset,
  listEarthEngineAssets: mocks.listEarthEngineAssets,
}));
vi.mock("@/infrastructure/earth-engine/client", () => ({
  initializeGee: mocks.initializeGee,
  evaluateGeeObject: mocks.evaluateGeeObject,
}));

import {
  buildCatalogDraft,
  discoverCatalogStatistics,
} from "@/services/indexCatalog/catalogBuild";

const properties = {
  level: "NIVEL_AGRUPAMENTO",
  locationName: "NOME_LOCAL",
  municipalityCode: "CD_MUN",
  stateCode: "NM_UF",
  year: "ano",
  date: "data_img",
  totalArea: "area_total_ha",
};

function schemaProperties(indexes = [1]) {
  return [
    ...Object.values(properties),
    ...indexes.map((index) => `perc_classe_${index}`),
    ...indexes.map((index) => `area_ha_classe_${index}`),
  ];
}

describe("index catalog GEE asset discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.evaluateGeeObject.mockImplementation(
      async (expression: Expression) => {
        if (expression.tag === "periods") {
          return expression.assetId.endsWith("2024")
            ? ["2024-01-01"]
            : expression.assetId.endsWith("2025")
              ? ["2025-02-01"]
              : [2025];
        }
        if (expression.tag === "invalid") return 0;
        if (expression.tag === "distinct") return 10;
        if (expression.level === "7_Municipio") return 5;
        if (expression.level === "7_Municipio-complete") return 5;
        if (expression.level === "6_Estado") return 2;
        if (expression.level === "6_Estado-complete") return 2;
        return 10;
      },
    );
    mocks.inspectEarthEngineAsset.mockImplementation(async (assetId: string) =>
      assetId.endsWith("map")
        ? {
            id: assetId,
            type: "image",
            bands: ["classification"],
            properties: [],
            updateTime: "2026-08-17T12:00:00Z",
          }
        : {
            id: assetId,
            type: "featureCollection",
            bands: [],
            properties: schemaProperties(),
            updateTime: "2026-08-17T11:00:00Z",
          },
    );
  });

  it("discovers a fixed annual FeatureCollection", async () => {
    await expect(
      discoverCatalogStatistics({
        kind: "gee-feature-collection",
        asset: { type: "fixed", assetId: "projects/x/assets/statistics" },
        periodGranularity: "year",
        properties,
      }),
    ).resolves.toEqual(
      expect.objectContaining({ periods: ["2025"], classIndexes: [1] }),
    );
    expect(mocks.listEarthEngineAssets).not.toHaveBeenCalled();
  });

  it("lists the template parent and discovers monthly assets only", async () => {
    mocks.listEarthEngineAssets.mockResolvedValue([
      { id: "projects/x/assets/stats_2024", type: "TABLE" },
      { id: "projects/x/assets/stats_2025", type: "TABLE" },
      { id: "projects/x/assets/map_2025", type: "IMAGE" },
      { id: "projects/x/assets/stats_backup", type: "TABLE" },
    ]);
    const result = await discoverCatalogStatistics({
      kind: "gee-feature-collection",
      asset: {
        type: "period-template",
        assetIdTemplate: "projects/x/assets/stats_{year}",
      },
      periodGranularity: "month",
      properties,
    });

    expect(mocks.listEarthEngineAssets).toHaveBeenCalledWith(
      "projects/x/assets",
    );
    expect(result.periods).toEqual(["2024-01", "2025-02"]);
    expect(result.assets.map((asset) => asset.assetId)).toEqual([
      "projects/x/assets/stats_2024",
      "projects/x/assets/stats_2025",
    ]);
  });

  it("builds lightweight imageData and a deterministic published source", async () => {
    const build = await buildCatalogDraft({
      schemaVersion: 2,
      panelLayerId: "novo-indice",
      status: "draft",
      name: "Novo índice",
      description: "Teste",
      category: "Dados Ambientais",
      statisticsSource: {
        kind: "gee-feature-collection",
        asset: { type: "fixed", assetId: "projects/x/assets/statistics" },
        periodGranularity: "year",
        properties,
      },
      classes: [],
      earthEngine: {
        strategy: "single",
        sourceType: "image",
        singleAssetId: "projects/x/assets/map",
        band: "classification",
      },
      createdBy: { uid: "a", email: null, at: "2026-08-17T10:00:00Z" },
      updatedBy: { uid: "a", email: null, at: "2026-08-17T10:00:00Z" },
    });

    expect(build.statisticsSource.sourceRevision).toMatch(/^[a-f0-9]{64}$/u);
    expect(build.panelLayerImageData.years["2025"].values).toEqual({});
    expect(build.panelLayerImageData.locations).toEqual({ br: "Brasil" });
    expect(build.classes).toEqual([
      expect.objectContaining({ classIndex: 1, label: "Classe 1" }),
    ]);
  });
});
