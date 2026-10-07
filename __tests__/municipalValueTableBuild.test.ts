import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@google/earthengine", () => ({ default: {} }));

const mocks = vi.hoisted(() => ({
  getStatisticsAssetIds: vi.fn(),
  readStatisticsAssetProperties: vi.fn(),
  readMunicipalValueTableProbes: vi.fn(),
  initializeGee: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/indexCatalog/statisticsAssetDiscovery", () => ({
  getStatisticsAssetIds: mocks.getStatisticsAssetIds,
}));
vi.mock("@/services/indexCatalog/statisticsAssetProbe", () => ({
  readStatisticsAssetProperties: mocks.readStatisticsAssetProperties,
}));
vi.mock("@/services/indexCatalog/municipalValueTableProbe", () => ({
  readMunicipalValueTableProbes: mocks.readMunicipalValueTableProbes,
}));
vi.mock("@/infrastructure/earth-engine/client", () => ({
  initializeGee: mocks.initializeGee,
  evaluateGeeObject: vi.fn(),
}));

import type { GeeMunicipalValueTableStatisticsSource } from "@/contracts/geeMunicipalValueTable";
import { discoverMunicipalValueTable } from "@/services/indexCatalog/municipalValueTableBuild";

const ASSET_ID = "projects/example/assets/pob_total";

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

const COLUMNS = ["CD_MUN", "NM_MUN", "SIGLA_UF", "AREA_KM2", "2024", "2025"];

function probe(overrides: Record<string, unknown> = {}) {
  return {
    rowCount: 5573,
    namedCount: 5573,
    codedCount: 5573,
    distinctCodeCount: 5573,
    stateValues: ["PB", "CE", "BA"],
    completeValueCounts: [5573, 5573],
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getStatisticsAssetIds.mockReset();
  mocks.readStatisticsAssetProperties.mockReset();
  mocks.readMunicipalValueTableProbes.mockReset();
  mocks.getStatisticsAssetIds.mockResolvedValue([
    { id: ASSET_ID, updateTime: "2026-01-01T00:00:00Z" },
  ]);
  mocks.readStatisticsAssetProperties.mockResolvedValue([COLUMNS]);
  mocks.readMunicipalValueTableProbes.mockResolvedValue(
    new Map([[ASSET_ID, probe()]]),
  );
});

describe("discoverMunicipalValueTable", () => {
  it("turns the period columns of a wide table into the layer periods", async () => {
    const discovery = await discoverMunicipalValueTable(source);

    expect(discovery.periods).toEqual(["2024", "2025"]);
    expect(discovery.municipalityCount).toBe(5573);
    expect(discovery.assets[0].columns).toEqual([
      { periodKey: "2024", column: "2024" },
      { periodKey: "2025", column: "2025" },
    ]);
  });

  it("reads the columns and the counts in two batched calls, not two per table", async () => {
    await discoverMunicipalValueTable(source);

    expect(mocks.readStatisticsAssetProperties).toHaveBeenCalledTimes(1);
    expect(mocks.readMunicipalValueTableProbes).toHaveBeenCalledTimes(1);
  });

  it("refuses a table with no column matching the value property", async () => {
    mocks.readStatisticsAssetProperties.mockResolvedValue([
      ["CD_MUN", "NM_MUN", "SIGLA_UF"],
    ]);

    await expect(discoverMunicipalValueTable(source)).rejects.toThrow(
      "nenhuma coluna de período",
    );
  });

  it("names the missing territorial columns and what each one should carry", async () => {
    mocks.readStatisticsAssetProperties.mockResolvedValue([
      ["CD_MUN", "2024", "2025"],
    ]);

    await expect(discoverMunicipalValueTable(source)).rejects.toThrow(
      "NM_MUN (nome do município), SIGLA_UF (UF)",
    );
  });

  // Escolher a forma errada da tabela quebra as duas checagens de uma vez, e é
  // vendo as duas juntas que se percebe que o errado foi a forma.
  it("reports the missing period and territorial columns at once", async () => {
    mocks.readStatisticsAssetProperties.mockResolvedValue([
      ["NIVEL_AGRUPAMENTO", "perc_classe_1", "area_ha_classe_1"],
    ]);

    await expect(discoverMunicipalValueTable(source)).rejects.toThrow(
      /nenhuma coluna de período que corresponda a \{year\}; não tem estas colunas do mapeamento: CD_MUN/u,
    );
  });

  it("points a perc_classe asset at the class-distribution shape", async () => {
    mocks.readStatisticsAssetProperties.mockResolvedValue([
      ["NIVEL_AGRUPAMENTO", "perc_classe_1", "area_ha_classe_1"],
    ]);

    await expect(discoverMunicipalValueTable(source)).rejects.toThrow(
      "Distribuição por classes",
    );
  });

  it("refuses a municipality repeated in the table", async () => {
    mocks.readMunicipalValueTableProbes.mockResolvedValue(
      new Map([[ASSET_ID, probe({ distinctCodeCount: 5570 })]]),
    );

    await expect(discoverMunicipalValueTable(source)).rejects.toThrow(
      "repete 3 município(s)",
    );
  });

  it("refuses an empty cell, which would drop the row from every period", async () => {
    mocks.readMunicipalValueTableProbes.mockResolvedValue(
      new Map([[ASSET_ID, probe({ completeValueCounts: [5573, 5500] })]]),
    );

    await expect(discoverMunicipalValueTable(source)).rejects.toThrow(
      "colunas 2025",
    );
  });

  it("refuses a state column that does not hold UFs", async () => {
    mocks.readMunicipalValueTableProbes.mockResolvedValue(
      new Map([[ASSET_ID, probe({ stateValues: ["Nordeste", "Norte"] })]]),
    );

    await expect(discoverMunicipalValueTable(source)).rejects.toThrow(
      "não são uma UF",
    );
  });

  it("refuses a table that is clearly not municipal", async () => {
    mocks.readMunicipalValueTableProbes.mockResolvedValue(
      new Map([
        [
          ASSET_ID,
          probe({
            rowCount: 67_000,
            namedCount: 67_000,
            codedCount: 67_000,
            distinctCodeCount: 67_000,
            completeValueCounts: [67_000, 67_000],
          }),
        ],
      ]),
    );

    await expect(discoverMunicipalValueTable(source)).rejects.toThrow(
      "tabela multinível",
    );
  });

  it("refuses the same period served by two tables", async () => {
    mocks.getStatisticsAssetIds.mockResolvedValue([
      { id: "projects/example/assets/pob_a" },
      { id: "projects/example/assets/pob_b" },
    ]);
    mocks.readStatisticsAssetProperties.mockResolvedValue([COLUMNS, COLUMNS]);
    mocks.readMunicipalValueTableProbes.mockResolvedValue(
      new Map([
        ["projects/example/assets/pob_a", probe()],
        ["projects/example/assets/pob_b", probe()],
      ]),
    );

    await expect(discoverMunicipalValueTable(source)).rejects.toThrow(
      "aparece em mais de uma tabela",
    );
  });
});
