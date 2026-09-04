import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  inspectEarthEngineAsset: vi.fn(),
  listEarthEngineAssets: vi.fn(),
  initializeGee: vi.fn(),
  evaluateGeeObject: vi.fn(),
}));

/**
 * O mock resolve expressões compostas, e não só folhas: a validação passou a
 * pedir um `ee.Dictionary` por tabela dentro de um `ee.List` por lote, então o
 * teste precisa refletir essa forma para contar idas e voltas de verdade.
 */
type Expression =
  | { tag: "list"; items: Expression[] }
  | { tag: "probe"; assetId: string; shape: Record<string, Expression> }
  | { tag: "property-names"; assetId: string }
  | {
      tag: "percentage-columns";
      assetId: string;
      propertyCount: number;
      unwrapped?: boolean;
      get?: (key: string) => Expression;
    }
  | { tag: string; assetId: string; level?: string; propertyCount?: number };

interface MockCollection {
  aggregate_array: (property: string) => { distinct: () => Expression };
  filter: (filter: { tag?: string; value?: string }) => MockCollection;
  distinct: () => { size: () => Expression };
  size: () => Expression;
  first: () => { assetId: string };
  reduceColumns: (reducer: unknown, properties: string[]) => Expression;
}

function percentageExpression(
  assetId: string,
  propertyCount: number,
  unwrapped = false,
): Expression {
  return {
    tag: "percentage-columns",
    assetId,
    propertyCount,
    unwrapped,
    get: () => percentageExpression(assetId, propertyCount, true),
  };
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
    first: () => ({ assetId }),
    reduceColumns: (_reducer: unknown, properties: string[]) =>
      percentageExpression(assetId, properties.length),
  };
}

function forecastCollection(assetId: string) {
  const collectionMock = {
    aggregate_array: (property: string) => {
      const expression = {
        tag:
          property === "data_emissao"
            ? "forecast-emissions"
            : property === "lead_time"
              ? "forecast-leads"
              : "forecast-target-dates",
        assetId,
      } satisfies Expression;
      return property === "data_emissao"
        ? {
            distinct: () => ({ sort: () => expression }),
          }
        : expression;
    },
    filter: () => collectionMock,
    sort: () => collectionMock,
  };
  return collectionMock;
}

vi.mock("@google/earthengine", () => ({
  default: {
    FeatureCollection: (assetId: string) => collection(assetId),
    ImageCollection: (assetId: string) => forecastCollection(assetId),
    Feature: (first: { assetId: string }) => ({
      propertyNames: () =>
        ({
          tag: "property-names",
          assetId: first.assetId,
        }) satisfies Expression,
    }),
    Dictionary: (shape: Record<string, Expression>) =>
      ({
        tag: "probe",
        assetId: String((shape.rowCount as { assetId?: string }).assetId),
        shape,
      }) satisfies Expression,
    List: (items: Expression[]) =>
      ({ tag: "list", items }) satisfies Expression,
    Filter: {
      notNull: () => ({ tag: "not-null" }),
      eq: (_property: string, value: string) => ({ tag: "level", value }),
    },
    Reducer: {
      toList: () => ({
        repeat: (count: number) => ({ tag: "to-list", count }),
      }),
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
import { clearStatisticsAssetCache } from "@/services/indexCatalog/statisticsAssetCache";

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

const MOCK_ROW_COUNT = 10;

function assetProperties(assetId: string) {
  if (assetId.endsWith("forecast-statistics")) {
    return schemaProperties([0, 1, 2, 3, 4, 5]);
  }
  // Uma tabela cujas colunas começam em perc_classe_2, como os assets de aridez.
  if (assetId.endsWith("aridez-statistics")) {
    return schemaProperties([2, 3, 4, 5]);
  }
  return schemaProperties();
}

/** Uma coluna por classe, cada linha somando 100 — o caso válido. */
function percentageColumns(propertyCount: number, rowTotal = 100) {
  return Array.from({ length: propertyCount }, () =>
    Array.from({ length: MOCK_ROW_COUNT }, () => rowTotal / propertyCount),
  );
}

let percentageColumnsBuilder: (propertyCount: number) => number[][] =
  percentageColumns;

function resolveLeaf(expression: Expression): unknown {
  if (expression.tag === "property-names") {
    return assetProperties(expression.assetId);
  }
  if (expression.tag === "periods") {
    if (expression.assetId.endsWith("forecast-statistics")) {
      return ["2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01"];
    }
    return expression.assetId.endsWith("2024")
      ? ["2024-01-01"]
      : expression.assetId.endsWith("2025")
        ? ["2025-02-01"]
        : [2025];
  }
  if (expression.tag === "forecast-emissions") return [20260701, 20260801];
  if (expression.tag === "forecast-leads") return [1, 2, 3, 4];
  if (expression.tag === "forecast-target-dates") {
    return [
      Date.UTC(2026, 8, 1),
      Date.UTC(2026, 9, 1),
      Date.UTC(2026, 10, 1),
      Date.UTC(2026, 11, 1),
    ];
  }
  if (expression.tag === "percentage-columns") {
    const columns = percentageColumnsBuilder(expression.propertyCount ?? 1);
    return "unwrapped" in expression && expression.unwrapped
      ? columns
      : { list: columns };
  }
  if (expression.tag === "distinct") return 10;
  if (expression.level === "7_Municipio") return 5;
  if (expression.level === "7_Municipio-complete") return 5;
  if (expression.level === "6_Estado") return 2;
  if (expression.level === "6_Estado-complete") return 2;
  return 10;
}

function resolveExpression(expression: Expression): unknown {
  if (expression.tag === "list") {
    return expression.items.map(resolveExpression);
  }
  if (expression.tag === "probe") {
    return Object.fromEntries(
      Object.entries(expression.shape).map(([field, value]) => [
        field,
        resolveExpression(value),
      ]),
    );
  }
  return resolveLeaf(expression);
}

/** Quantas expressões de leitura de linhas foram realmente avaliadas. */
function probedAssetIds() {
  return mocks.evaluateGeeObject.mock.calls.flatMap(
    ([expression]: [Expression]) =>
      expression.tag === "list"
        ? expression.items
            .filter((item) => item.tag === "probe")
            .map((item) => (item as { assetId: string }).assetId)
        : expression.tag === "probe"
          ? [(expression as { assetId: string }).assetId]
          : [],
  );
}

describe("index catalog GEE asset discovery", () => {
  function overridePercentageColumns(
    build: (propertyCount: number) => number[][],
  ) {
    percentageColumnsBuilder = build;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    clearStatisticsAssetCache();
    percentageColumnsBuilder = percentageColumns;
    mocks.evaluateGeeObject.mockImplementation(async (expression: Expression) =>
      resolveExpression(expression),
    );
    mocks.inspectEarthEngineAsset.mockImplementation(async (assetId: string) =>
      assetId.endsWith("forecast-map")
        ? {
            id: assetId,
            type: "imageCollection",
            bands: ["b1"],
            properties: [],
            updateTime: "2026-08-17T12:00:00Z",
          }
        : assetId.endsWith("map")
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
              properties: assetProperties(assetId),
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

  const fixedSource = {
    kind: "gee-feature-collection",
    asset: { type: "fixed", assetId: "projects/x/assets/statistics" },
    periodGranularity: "year",
    properties,
  } as const;

  // A validação de um asset é memoizada por revisão: revalidar a prévia e
  // publicar em seguida não deve repetir a leitura das linhas no Earth Engine.
  it("reuses the validation of an asset that has not been re-exported", async () => {
    await discoverCatalogStatistics(fixedSource);
    expect(probedAssetIds()).toEqual(["projects/x/assets/statistics"]);

    await discoverCatalogStatistics(fixedSource);

    // Nenhuma leitura de linhas nova: a segunda descoberta reaproveita a
    // primeira e só relê o schema, que é o que responde "a tabela mudou?".
    expect(probedAssetIds()).toEqual(["projects/x/assets/statistics"]);
    expect(mocks.inspectEarthEngineAsset).toHaveBeenCalledTimes(2);
  });

  it("validates again when the asset has been re-exported", async () => {
    await discoverCatalogStatistics(fixedSource);
    mocks.inspectEarthEngineAsset.mockImplementation(
      async (assetId: string) => ({
        id: assetId,
        type: "featureCollection",
        bands: [],
        properties: schemaProperties(),
        updateTime: "2026-08-18T09:00:00Z",
      }),
    );

    await discoverCatalogStatistics(fixedSource);

    expect(probedAssetIds()).toEqual([
      "projects/x/assets/statistics",
      "projects/x/assets/statistics",
    ]);
  });

  // O `getAsset` não devolve `updateTime` em nenhum asset que medimos, e sem
  // carimbo a memoização de um asset fixo nunca engatava. O `version` vem
  // sempre, e é o mesmo instante em microssegundos.
  it("memoizes a fixed asset that only reports version, not updateTime", async () => {
    mocks.inspectEarthEngineAsset.mockImplementation(
      async (assetId: string) => ({
        id: assetId,
        type: "featureCollection",
        bands: [],
        properties: schemaProperties(),
        version: "1787861735398000",
      }),
    );

    await discoverCatalogStatistics(fixedSource);
    await discoverCatalogStatistics(fixedSource);

    expect(probedAssetIds()).toEqual(["projects/x/assets/statistics"]);
  });

  // A checagem por linha dos percentuais saiu do Earth Engine e passou a rodar
  // no Node; estes dois casos fixam que a guarda continua valendo.
  it("rejects an asset whose percentages do not add up to 100", async () => {
    overridePercentageColumns((propertyCount) =>
      percentageColumns(propertyCount, 90),
    );
    await expect(
      discoverCatalogStatistics({
        kind: "gee-feature-collection",
        asset: { type: "fixed", assetId: "projects/x/assets/statistics" },
        periodGranularity: "year",
        properties,
      }),
    ).rejects.toThrow(/possui 10 linha\(s\) com percentuais fora de 0–100/u);
  });

  it("rejects percentage columns that come back misaligned with the row count", async () => {
    overridePercentageColumns((propertyCount) =>
      percentageColumns(propertyCount).map((column) => column.slice(1)),
    );
    await expect(
      discoverCatalogStatistics({
        kind: "gee-feature-collection",
        asset: { type: "fixed", assetId: "projects/x/assets/statistics" },
        periodGranularity: "year",
        properties,
      }),
    ).rejects.toThrow(/retornou 9 valor\(es\); esperado 10, um por linha/u);
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

  it("casa a legenda do legado por posição quando a tabela começa noutro número", async () => {
    // Um v2 criado a partir de um legado traz a legenda do Contentful, e só a
    // tabela sabe se as colunas são perc_classe_0..5 ou perc_classe_2..5. Sem o
    // casamento por posição, as quatro classes de aridez nasceriam como
    // "Classe 2".."Classe 5" no cinza padrão, com as cores deslocadas.
    const build = await buildCatalogDraft({
      schemaVersion: 2,
      panelLayerId: "indice-de-aridez",
      status: "draft",
      name: "Índice de Aridez",
      description: "Teste",
      category: "Dados Climáticos",
      statisticsSource: {
        kind: "gee-feature-collection",
        asset: {
          type: "fixed",
          assetId: "projects/x/assets/aridez-statistics",
        },
        periodGranularity: "year",
        properties,
      },
      classes: [
        { classIndex: 1, id: "arido", label: "Árido", color: "#FF0000" },
        {
          classIndex: 2,
          id: "semiarido",
          label: "Semiárido",
          color: "#FFA500",
        },
        {
          classIndex: 3,
          id: "subumido",
          label: "Subúmido Seco",
          color: "#FFFF00",
        },
        { classIndex: 4, id: "umido", label: "Úmido", color: "#00FF00" },
      ],
      earthEngine: {
        strategy: "single",
        sourceType: "image",
        singleAssetId: "projects/x/assets/map",
        band: "classification",
      },
      createdBy: { uid: "a", email: null, at: "2026-08-17T10:00:00Z" },
      updatedBy: { uid: "a", email: null, at: "2026-08-17T10:00:00Z" },
    });

    expect(
      build.classes.map(({ classIndex, label, color }) => ({
        classIndex,
        label,
        color,
      })),
    ).toEqual([
      { classIndex: 2, label: "Árido", color: "#FF0000" },
      { classIndex: 3, label: "Semiárido", color: "#FFA500" },
      { classIndex: 4, label: "Subúmido Seco", color: "#FFFF00" },
      { classIndex: 5, label: "Úmido", color: "#00FF00" },
    ]);
  });

  it("pins the latest forecast issuance and maps each period to its lead", async () => {
    const build = await buildCatalogDraft({
      schemaVersion: 2,
      panelLayerId: "previsao-temperatura",
      status: "draft",
      name: "Previsão de temperatura",
      description: "Teste",
      category: "Dados Climáticos",
      statisticsSource: {
        kind: "gee-feature-collection",
        asset: {
          type: "fixed",
          assetId: "projects/x/assets/forecast-statistics",
        },
        periodGranularity: "month",
        properties,
      },
      classes: [],
      earthEngine: {
        strategy: "single",
        sourceType: "imageCollection",
        singleAssetId: "projects/x/assets/forecast-map",
        band: "b1",
        thresholds: [-90, -30, 0, 30, 90],
        collectionSelection: {
          type: "latest-emission-leads",
          emissionProperty: "data_emissao",
          leadProperty: "lead_time",
          targetDateProperty: "system:time_start",
          leadValues: [1, 2, 3, 4],
        },
      },
      createdBy: { uid: "a", email: null, at: "2026-08-17T10:00:00Z" },
      updatedBy: { uid: "a", email: null, at: "2026-08-17T10:00:00Z" },
    });

    expect(build.panelLayerImageData.defaultYear).toBe("2026-09");
    expect(build.panelLayerImageData.years).toEqual(
      expect.objectContaining({
        "2026-09": expect.objectContaining({ leadTime: 1 }),
        "2026-10": expect.objectContaining({ leadTime: 2 }),
        "2026-11": expect.objectContaining({ leadTime: 3 }),
        "2026-12": expect.objectContaining({ leadTime: 4 }),
      }),
    );
    expect(build.mapVisualization.imageCollectionSelection).toEqual({
      latestProperty: "data_emissao",
      latestValue: 20260801,
      filterProperty: "lead_time",
      sortProperty: "lead_time",
      selectFirstBand: true,
    });
  });
});
