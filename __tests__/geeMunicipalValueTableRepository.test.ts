import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/**
 * Earth Engine falso, com o suficiente para o adaptador montar a expressão e o
 * teste conferir o que foi pedido: quantas idas ao Earth Engine, sobre quais
 * assets e com qual redutor.
 */
const { fakeEarthEngine, requests } = vi.hoisted(() => {
  const requests: unknown[] = [];

  class FakeReducer {
    constructor(
      readonly name: string,
      readonly repeated = 0,
      readonly grouped = false,
    ) {}
    repeat = (count: number) => new FakeReducer(this.name, count);
    group = () => new FakeReducer(this.name, this.repeated, true);
  }

  class FakeCollection {
    constructor(readonly assetId: string) {}
    filter = () => this;
    size = () => ({ gt: () => true });
    first = () => ({ assetId: this.assetId });
    reduceColumns = (reducer: FakeReducer, selectors: string[]) => ({
      get: (key: string) => ({
        assetId: this.assetId,
        reducer: reducer.name,
        grouped: reducer.grouped,
        selectors,
        key,
      }),
    });
  }

  class FakeEarthEngine {
    FeatureCollection = (assetId: string) => new FakeCollection(assetId);
    Feature = (value: { assetId: string }) => ({
      toDictionary: (properties: string[]) => ({ ...value, properties }),
    });
    Filter = { eq: () => ({}) };
    Reducer = {
      sum: () => new FakeReducer("sum"),
      mean: () => new FakeReducer("mean"),
    };
    Algorithms = { If: (_condition: unknown, value: unknown) => value };
    Dictionary = (value: unknown) => {
      requests.push(value);
      return value;
    };
  }

  return { fakeEarthEngine: new FakeEarthEngine(), requests };
});

vi.mock("@google/earthengine", () => ({ default: fakeEarthEngine }));
vi.mock("@/infrastructure/earth-engine/client", () => ({
  evaluateGeeObject: vi.fn(),
  initializeGee: vi.fn().mockResolvedValue(undefined),
}));

import type { GeeMunicipalValueTableStatisticsSource } from "@/contracts/geeMunicipalValueTable";
import { evaluateGeeObject } from "@/infrastructure/earth-engine/client";
import {
  getMunicipalValueTableYearPatch,
  planValueTableReads,
} from "@/repositories/platform/geeMunicipalValueTableRepository";
import { clearGeeStatisticsRowsCache } from "@/repositories/platform/geeStatisticsRowsCache";

const ASSET_ID = "projects/example/assets/pob_total";
const PERIODS = ["2012", "2013", "2014"];

const source: GeeMunicipalValueTableStatisticsSource = {
  kind: "gee-municipal-value-table",
  asset: { type: "fixed", assetId: ASSET_ID },
  periodGranularity: "year",
  valueProperty: "{year}",
  aggregation: "mean",
  properties: {
    municipalityCode: "CD_MUN",
    locationName: "NM_MUN",
    stateCode: "SIGLA_UF",
  },
};

const evaluate = vi.mocked(evaluateGeeObject);

beforeEach(() => {
  clearGeeStatisticsRowsCache();
  requests.length = 0;
  evaluate.mockReset();
});

describe("planValueTableReads", () => {
  it("keeps a wide table as a single read with one column per period", () => {
    expect(planValueTableReads(source, PERIODS)).toEqual([
      { assetId: ASSET_ID, periodKeys: PERIODS, valueColumns: PERIODS },
    ]);
  });

  it("splits the periods across the assets that hold them", () => {
    const plans = planValueTableReads(
      {
        ...source,
        asset: {
          type: "period-template",
          assetIdTemplate: "projects/example/assets/pob_{year}",
        },
        valueProperty: "valor",
      },
      ["2023", "2024"],
    );

    expect(plans.map((plan) => plan.assetId)).toEqual([
      "projects/example/assets/pob_2023",
      "projects/example/assets/pob_2024",
    ]);
  });

  it("drops a period that does not fit the granularity instead of failing", () => {
    expect(planValueTableReads(source, ["2024", "2024-03"])).toEqual([
      { assetId: ASSET_ID, periodKeys: ["2024"], valueColumns: ["2024"] },
    ]);
  });
});

describe("getMunicipalValueTableYearPatch", () => {
  it("reads the whole series once and serves the other periods from cache", async () => {
    evaluate.mockResolvedValue({
      [ASSET_ID]: {
        total: [70.2, 64.9, 62.6],
        byState: [{ uf: "PB", mean: [79.9, 76.4, 75.1] }],
      },
    });

    const first = await getMunicipalValueTableYearPatch(
      source,
      "2012",
      "br",
      PERIODS,
    );
    const second = await getMunicipalValueTableYearPatch(
      source,
      "2014",
      "br",
      PERIODS,
    );

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(first.patch.years?.["2012"]?.values).toEqual({
      br: [70.2],
      pb: [79.9],
    });
    expect(second.patch.years?.["2014"]?.values).toEqual({
      br: [62.6],
      pb: [75.1],
    });
  });

  it("shares the aggregated read between Brazil and a single state", async () => {
    evaluate.mockResolvedValue({
      [ASSET_ID]: {
        total: [70.2, 64.9, 62.6],
        byState: [{ uf: "Paraíba", mean: [79.9, 76.4, 75.1] }],
      },
    });

    await getMunicipalValueTableYearPatch(source, "2012", "br", PERIODS);
    const state = await getMunicipalValueTableYearPatch(
      source,
      "2013",
      "pb",
      PERIODS,
    );

    expect(evaluate).toHaveBeenCalledTimes(1);
    expect(state.patch.years?.["2013"]?.values).toEqual({ pb: [76.4] });
  });

  it("asks Earth Engine for the requested aggregation", async () => {
    evaluate.mockResolvedValue({
      [ASSET_ID]: { total: [742], byState: [] },
    });

    await getMunicipalValueTableYearPatch(
      { ...source, aggregation: "sum" },
      "2012",
      "br",
      ["2012"],
    );

    expect(JSON.stringify(requests)).toContain('"reducer":"sum"');
  });

  it("reads a single municipality row instead of aggregating", async () => {
    evaluate.mockResolvedValue({
      [ASSET_ID]: {
        "2012": 83.1,
        "2013": 79.1,
        "2014": 78.6,
        CD_MUN: "2507507",
        NM_MUN: "João Pessoa",
        SIGLA_UF: "PB",
      },
    });

    const result = await getMunicipalValueTableYearPatch(
      source,
      "2013",
      "2507507",
      PERIODS,
    );

    expect(result.patch.locations).toEqual({ "2507507": "João Pessoa - PB" });
    expect(result.patch.years?.["2013"]?.values).toEqual({ "2507507": [79.1] });
  });

  it("returns an empty period for a municipality missing from the table", async () => {
    evaluate.mockResolvedValue({ [ASSET_ID]: {} });

    const result = await getMunicipalValueTableYearPatch(
      source,
      "2013",
      "2507507",
      PERIODS,
    );

    expect(result.patch.locations).toEqual({});
    expect(result.patch.years?.["2013"]?.values).toEqual({});
  });

  it("recusa o período pedido que a fonte não sabe resolver", async () => {
    // Regressão: o período incompatível era descartado junto com os outros, e
    // como a série tinha períodos válidos a leitura seguia adiante. A resposta
    // saía 200 com o período vazio — "sem dado" no painel — em vez de dizer que
    // o período não existe nesta fonte, que é o que o caminho classificatório
    // faz e o que o comentário de `planValueTableReads` prometia.
    await expect(
      getMunicipalValueTableYearPatch(source, "2013-04", "br", PERIODS),
    ).rejects.toThrow(/2013-04/u);
    expect(evaluate).not.toHaveBeenCalled();
  });

  it("answers an aggregate spatial scope with no data instead of failing", async () => {
    const result = await getMunicipalValueTableYearPatch(
      source,
      "2013",
      "3_bioma-caatinga",
      PERIODS,
    );

    expect(evaluate).not.toHaveBeenCalled();
    expect(result.patch.years?.["2013"]?.values).toEqual({});
  });
});
