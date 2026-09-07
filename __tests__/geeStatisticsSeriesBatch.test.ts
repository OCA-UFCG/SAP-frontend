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
      stringStartsWith: () => ({}),
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
  getStatisticsRowsBatchSize,
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

function municipalRow(
  assetId: string,
  municipalityCode = "2507507",
  locationName = "João Pessoa",
) {
  return {
    NIVEL_AGRUPAMENTO: "7_Municipio",
    NOME_LOCAL: locationName,
    CD_MUN: municipalityCode,
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
  it("lê os 45 anos em 10 idas ao Earth Engine, não em 90", async () => {
    const result = await readPeriod("2020");

    expect(mockedEvaluate).toHaveBeenCalledTimes(10);
    expect(result?.patch.years?.["2020"]?.values).toEqual({
      "2507507": [40, 60],
    });
  });

  // Regressão: com 15 assets por pedido, a leitura municipal — que traz a UF
  // inteira — passava de 5000 feições nos estados grandes e o Earth Engine
  // abortava com "Collection query aborted after accumulating over 5000
  // elements". Medido no índice de aridez do ERA5-Land, falhava em Minas
  // Gerais, São Paulo, Rio Grande do Sul, Bahia e Paraná.
  it("agrupa a leitura municipal em blocos que caibam no teto de 5000 feições", async () => {
    await readPeriod("2020");

    const batchSizes = mockedEvaluate.mock.calls
      .map(([object]) => object as FakeNode)
      .filter((node) => node.kind !== "propertyNames")
      .map((node) => node.assetIds.length);

    expect(batchSizes).toEqual([5, 5, 5, 5, 5, 5, 5, 5, 5]);
    expect(Math.max(...batchSizes) * 853).toBeLessThanOrEqual(5000);
  });

  it("mantém os blocos de 15 fora da leitura municipal", () => {
    expect(getStatisticsRowsBatchSize("br")).toBe(15);
    expect(getStatisticsRowsBatchSize("pb")).toBe(15);
    expect(getStatisticsRowsBatchSize("5_semiarido-semiarido")).toBe(15);
    expect(getStatisticsRowsBatchSize("3100104")).toBe(5);
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

  // A leitura municipal traz a UF inteira porque o preço é o da ida ao Earth
  // Engine, não o do volume: medido no ERA5-Land (45 anos), um município custou
  // 2985 ms e os 223 municípios da Paraíba, 3122 ms. Antes disso, cada
  // município novo pagava a série inteira de novo.
  it("serve outro município da mesma UF sem voltar ao Earth Engine", async () => {
    mockedEvaluate.mockImplementation(async (object: unknown) => {
      const node = object as FakeNode;
      if (node.kind === "propertyNames") return PROPERTY_NAMES as never;
      return {
        features: node.assetIds.flatMap((assetId) => [
          { properties: municipalRow(assetId) },
          { properties: municipalRow(assetId, "2504009", "Campina Grande") },
        ]),
      } as never;
    });

    await readPeriod("2020");
    mockedEvaluate.mockClear();

    const result = await getGeeStatisticsYearPatch(
      "indicearidez",
      "2020",
      "2504009",
      2,
      source,
      YEARS,
    );

    expect(mockedEvaluate).not.toHaveBeenCalled();
    expect(result?.patch.years?.["2020"]?.values).toEqual({
      "2504009": [40, 60],
    });
  });

  it("volta ao Earth Engine quando o município é de outra UF", async () => {
    await readPeriod("2020");
    mockedEvaluate.mockClear();

    await getGeeStatisticsYearPatch(
      "indicearidez",
      "2020",
      "3550308",
      2,
      source,
      YEARS,
    );

    expect(mockedEvaluate).toHaveBeenCalled();
  });

  it("ignora um período incompatível com a granularidade sem derrubar a série", async () => {
    await expect(
      getGeeStatisticsYearPatch("indicearidez", "2020", "2507507", 2, source, [
        ...YEARS,
        "2020-07",
      ]),
    ).resolves.not.toBeNull();

    // O período inválido não vira um asset, então a série continua nos mesmos
    // 45 anos: uma leitura de schema e nove blocos de 5 assets.
    expect(mockedEvaluate).toHaveBeenCalledTimes(10);
  });
});
