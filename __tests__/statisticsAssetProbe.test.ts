import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({ evaluateGeeObject: vi.fn() }));

type Expression =
  | { tag: "list"; items: Expression[] }
  | { tag: "probe"; assetId: string; shape: Record<string, Expression> }
  | { tag: "property-names"; assetId: string }
  | { tag: string; assetId?: string };

function fakeCollection(assetId: string) {
  const self = {
    aggregate_array: () => ({ distinct: () => ({ tag: "periods", assetId }) }),
    filter: () => self,
    distinct: () => ({ size: () => ({ tag: "distinct", assetId }) }),
    size: () => ({ tag: "size", assetId }),
    first: () => ({ assetId }),
    reduceColumns: () => ({ get: () => ({ tag: "percentages", assetId }) }),
  };
  return self;
}

vi.mock("@google/earthengine", () => ({
  default: {
    FeatureCollection: fakeCollection,
    Feature: (first: { assetId: string }) => ({
      propertyNames: () => ({ tag: "property-names", assetId: first.assetId }),
    }),
    Dictionary: (shape: Record<string, Expression>) => ({
      tag: "probe",
      assetId: (shape.rowCount as { assetId: string }).assetId,
      shape,
    }),
    List: (items: Expression[]) => ({ tag: "list", items }),
    Filter: { notNull: () => ({ tag: "not-null" }), eq: () => ({ tag: "eq" }) },
    Reducer: { toList: () => ({ repeat: () => ({ tag: "to-list" }) }) },
  },
}));

vi.mock("@/infrastructure/earth-engine/client", () => ({
  evaluateGeeObject: mocks.evaluateGeeObject,
}));

import {
  readStatisticsAssetProbes,
  readStatisticsAssetProperties,
} from "@/services/indexCatalog/statisticsAssetProbe";
import type { ResolvedGeeStatisticsSource } from "@/contracts/geeStatistics";

const schema = {
  classIndexes: [1],
  percentageProperties: ["perc_classe_1"],
  classAreaProperties: ["area_ha_classe_1"],
};

function source(assetId: string): ResolvedGeeStatisticsSource {
  return {
    kind: "gee-feature-collection",
    assetId,
    asset: { type: "fixed", assetId },
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
  } as ResolvedGeeStatisticsSource;
}

function probeFor(assetId: string) {
  return {
    periods: [2024],
    rowCount: 10,
    completeCount: 10,
    distinctCount: 10,
    municipalCount: 5,
    completeMunicipalCount: 5,
    stateCount: 2,
    completeStateCount: 2,
    percentageColumns: [[assetId.length]],
  };
}

/** Responde a cada `ee.List` com um resultado por item, como o Earth Engine. */
function resolveList(expression: Expression) {
  if (expression.tag !== "list") throw new Error("esperava um lote");
  return expression.items.map((item) =>
    item.tag === "property-names"
      ? ["system:index", "NOME_LOCAL", "perc_classe_1"]
      : probeFor((item as { assetId: string }).assetId),
  );
}

describe("readStatisticsAssetProperties", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.evaluateGeeObject.mockImplementation(async (expression: Expression) =>
      resolveList(expression),
    );
  });

  it("lê as colunas de todas as tabelas em uma única ida ao Earth Engine", async () => {
    const assetIds = Array.from({ length: 35 }, (_, index) => `t_${index}`);

    const properties = await readStatisticsAssetProperties(assetIds);

    expect(mocks.evaluateGeeObject).toHaveBeenCalledTimes(1);
    expect(properties).toHaveLength(35);
  });

  it("descarta as propriedades system: do Earth Engine", async () => {
    const [properties] = await readStatisticsAssetProperties(["t_1"]);

    expect(properties).toEqual(["NOME_LOCAL", "perc_classe_1"]);
  });

  it("não fala com o Earth Engine quando não há tabela nenhuma", async () => {
    await expect(readStatisticsAssetProperties([])).resolves.toEqual([]);

    expect(mocks.evaluateGeeObject).not.toHaveBeenCalled();
  });

  // Um lote que volta com menos resultados desalinharia schema e tabela, e a
  // validação passaria a conferir as colunas de uma tabela contra outra.
  it("nomeia a tabela quando o lote volta incompleto", async () => {
    mocks.evaluateGeeObject.mockResolvedValue([["NOME_LOCAL"]]);

    await expect(readStatisticsAssetProperties(["t_1", "t_2"])).rejects.toThrow(
      /não devolveu as colunas de t_2/u,
    );
  });
});

describe("readStatisticsAssetProbes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.evaluateGeeObject.mockImplementation(async (expression: Expression) =>
      resolveList(expression),
    );
  });

  it("lê as 35 tabelas de um índice anual em 4 idas, e não em 280", async () => {
    const requests = Array.from({ length: 35 }, (_, index) => ({
      source: source(`t_${index}`),
      schema,
    }));

    const probes = await readStatisticsAssetProbes(requests);

    expect(mocks.evaluateGeeObject).toHaveBeenCalledTimes(4);
    expect(probes.size).toBe(35);
    expect(probes.get("t_34")?.rowCount).toBe(10);
  });

  it("pede tudo de uma tabela numa única expressão", async () => {
    await readStatisticsAssetProbes([{ source: source("t_1"), schema }]);

    const [expression] = mocks.evaluateGeeObject.mock.calls[0] as [Expression];
    expect(expression.tag).toBe("list");
    expect((expression as { items: Expression[] }).items).toHaveLength(1);
  });

  it("não fala com o Earth Engine quando não há tabela pendente", async () => {
    const probes = await readStatisticsAssetProbes([]);

    expect(probes.size).toBe(0);
    expect(mocks.evaluateGeeObject).not.toHaveBeenCalled();
  });

  it("nomeia a tabela quando o lote volta sem a leitura dela", async () => {
    mocks.evaluateGeeObject.mockResolvedValue([probeFor("t_1")]);

    await expect(
      readStatisticsAssetProbes([
        { source: source("t_1"), schema },
        { source: source("t_2"), schema },
      ]),
    ).rejects.toThrow(/não devolveu a leitura de t_2/u);
  });
});
