import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

interface FakeNode {
  kind: "collection" | "feature" | "propertyNames";
  assetIds: string[];
  filter: () => FakeNode;
  map: () => FakeNode;
  flatten: () => FakeNode;
  first: () => FakeNode;
  toDictionary: () => FakeNode;
  propertyNames: () => FakeNode;
}

/**
 * Earth Engine falso. Cada nó carrega os assets que representa, para o
 * `evaluateGeeObject` falso saber quantas tabelas entraram no mesmo pedido —
 * que é exatamente o que este teste mede. Fica dentro de `vi.hoisted` porque
 * `vi.mock` é içado para antes das declarações do arquivo.
 */
const { fakeEarthEngine } = vi.hoisted(() => {
  class FakeEarthEngine {
    FeatureCollection = (input: unknown) => {
      const assetIds = Array.isArray(input)
        ? input.flatMap((item) => (item as FakeNode).assetIds)
        : [String(input)];
      return this.node(assetIds, "collection");
    };

    Feature = (value: unknown) =>
      this.node((value as FakeNode | null)?.assetIds ?? [], "feature");

    Filter = {
      eq: () => ({}),
      and: () => ({}),
      or: () => ({}),
    };

    private node(assetIds: string[], kind: FakeNode["kind"]): FakeNode {
      const node: FakeNode = {
        kind,
        assetIds,
        filter: () => node,
        map: () => node,
        flatten: () => node,
        first: () => this.node(assetIds, "feature"),
        toDictionary: () => this.node(assetIds, "feature"),
        propertyNames: () => ({ ...node, kind: "propertyNames" }),
      };
      return node;
    }
  }

  return { fakeEarthEngine: new FakeEarthEngine() };
});

vi.mock("@google/earthengine", () => ({ default: fakeEarthEngine }));
vi.mock("@/infrastructure/earth-engine/client", () => ({
  evaluateGeeObject: vi.fn(),
  initializeGee: vi.fn().mockResolvedValue(undefined),
}));

import type { GeeFeatureCollectionStatisticsSource } from "@/contracts/geeStatistics";
import { evaluateGeeObject } from "@/infrastructure/earth-engine/client";
import {
  clearGeeStatisticsSchemaCacheForTests,
  getGeeStatisticsYearPatch,
} from "@/repositories/platform/geeStatisticsRepository";
import { clearGeeStatisticsRowsCache } from "@/repositories/platform/geeStatisticsRowsCache";

const ASSET_TEMPLATE = "projects/example/assets/aridez_{year}";
const YEARS = Array.from({ length: 45 }, (_, index) => String(1980 + index));

const PROPERTY_NAMES = [
  "NIVEL_AGRUPAMENTO",
  "NOME_LOCAL",
  "CD_MUN",
  "NM_UF",
  "ano",
  "data_img",
  "area_total_ha",
  "perc_classe_1",
  "perc_classe_2",
  "area_ha_classe_1",
  "area_ha_classe_2",
];

const source: GeeFeatureCollectionStatisticsSource = {
  kind: "gee-feature-collection",
  asset: { type: "period-template", assetIdTemplate: ASSET_TEMPLATE },
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
};

function municipalRow(assetId: string) {
  return {
    NIVEL_AGRUPAMENTO: "7_Municipio",
    NOME_LOCAL: "João Pessoa",
    CD_MUN: "2507507",
    NM_UF: "PB",
    ano: Number(assetId.slice(-4)),
    perc_classe_1: 40,
    perc_classe_2: 60,
  };
}

const mockedEvaluate = vi.mocked(evaluateGeeObject);

beforeEach(() => {
  clearGeeStatisticsSchemaCacheForTests();
  clearGeeStatisticsRowsCache();
  mockedEvaluate.mockReset();
  mockedEvaluate.mockImplementation(async (object: unknown) => {
    const node = object as FakeNode;
    if (node.kind === "propertyNames") return PROPERTY_NAMES as never;
    return {
      features: node.assetIds.map((assetId) => ({
        properties: municipalRow(assetId),
      })),
    } as never;
  });
});

function readPeriod(yearKey: string) {
  return getGeeStatisticsYearPatch(
    "indicearidez",
    yearKey,
    "2507507",
    2,
    source,
    YEARS,
  );
}

describe("leitura em lote da série estatística", () => {
  // Regressão: cada período resolvia um assetId próprio, então abrir o índice
  // de aridez do ERA5-Land custava 45 leituras de schema e 45 de linhas — 90
  // idas ao Earth Engine, ~17 s só nas linhas.
  it("lê os 45 anos em 4 idas ao Earth Engine, não em 90", async () => {
    const result = await readPeriod("2020");

    expect(mockedEvaluate).toHaveBeenCalledTimes(4);
    expect(result?.patch.years?.["2020"]?.values).toEqual({
      "2507507": [40, 60],
    });
  });

  it("agrupa os assets em blocos de 15", async () => {
    await readPeriod("2020");

    const batchSizes = mockedEvaluate.mock.calls
      .map(([object]) => object as FakeNode)
      .filter((node) => node.kind !== "propertyNames")
      .map((node) => node.assetIds.length);

    expect(batchSizes).toEqual([15, 15, 15]);
  });

  it("serve os outros períodos da mesma leitura, sem voltar ao Earth Engine", async () => {
    await readPeriod("2020");
    mockedEvaluate.mockClear();

    const result = await readPeriod("1995");

    expect(mockedEvaluate).not.toHaveBeenCalled();
    expect(result?.patch.years?.["1995"]?.values).toEqual({
      "2507507": [40, 60],
    });
  });

  it("mantém a leitura de um período só quando os períodos não são informados", async () => {
    const result = await getGeeStatisticsYearPatch(
      "indicearidez",
      "2020",
      "2507507",
      2,
      source,
    );

    const readAssets = mockedEvaluate.mock.calls
      .map(([object]) => object as FakeNode)
      .filter((node) => node.kind !== "propertyNames")
      .flatMap((node) => node.assetIds);

    expect(readAssets).toEqual(["projects/example/assets/aridez_2020"]);
    expect(result?.assetId).toBe("projects/example/assets/aridez_2020");
  });

  it("ignora um período incompatível com a granularidade sem derrubar a série", async () => {
    await expect(
      getGeeStatisticsYearPatch("indicearidez", "2020", "2507507", 2, source, [
        ...YEARS,
        "2020-07",
      ]),
    ).resolves.not.toBeNull();

    expect(mockedEvaluate).toHaveBeenCalledTimes(4);
  });
});
