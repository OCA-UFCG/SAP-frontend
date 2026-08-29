import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@google/earthengine", () => ({ default: {} }));
vi.mock("@/infrastructure/earth-engine/client", () => ({
  evaluateGeeObject: vi.fn(),
  initializeGee: vi.fn(),
}));

import type {
  GeeStatisticsSchema,
  ResolvedGeeStatisticsSource,
} from "@/contracts/geeStatistics";
import {
  mapGeeStatisticsRows,
  matchesStatisticsPeriod,
} from "@/repositories/platform/geeStatisticsRepository";

const source: ResolvedGeeStatisticsSource = {
  kind: "gee-feature-collection",
  asset: {
    type: "fixed",
    assetId: "projects/example/assets/statistics",
  },
  assetId: "projects/example/assets/statistics",
  periodGranularity: "month",
  properties: {
    level: "NIVEL_AGRUPAMENTO",
    locationName: "NOME_LOCAL",
    municipalityCode: "CD_MUN",
    stateCode: "NM_UF",
    year: "ano",
    date: "data_img",
    totalArea: "area_total_ha",
    scalarMetrics: { mean: "media_Carbono" },
  },
};

const schema: GeeStatisticsSchema = {
  classIndexes: [1, 2],
  percentageProperties: ["perc_classe_1", "perc_classe_2"],
  classAreaProperties: ["area_ha_classe_1", "area_ha_classe_2"],
};

describe("geeStatisticsRepository mapping", () => {
  it("maps Brazil and state rows for the national ranking slice", () => {
    const result = mapGeeStatisticsRows(
      source,
      schema,
      "2020-01",
      "br",
      [
        {
          NIVEL_AGRUPAMENTO: "1_BR",
          NOME_LOCAL: "Brasil Total",
          perc_classe_1: 40,
          perc_classe_2: 60,
        },
        {
          NIVEL_AGRUPAMENTO: "6_Estado",
          NOME_LOCAL: "Paraíba",
          NM_UF: "PB",
          perc_classe_1: 25,
          perc_classe_2: 75,
        },
      ],
      2,
    );

    expect(result.patch.locations).toEqual({ br: "Brasil", pb: "Paraíba" });
    expect(result.patch.years?.["2020-01"]?.values).toEqual({
      br: [40, 60],
      pb: [25, 75],
    });
  });

  it("maps a municipality by stable IBGE code and exposes its metrics", () => {
    const result = mapGeeStatisticsRows(
      source,
      schema,
      "2020-01",
      "2507507",
      [
        {
          NIVEL_AGRUPAMENTO: "7_Municipio",
          NOME_LOCAL: "João Pessoa",
          NM_UF: "PB",
          CD_MUN: "2507507",
          perc_classe_1: 10,
          perc_classe_2: 90,
          area_total_ha: 20_000,
          area_ha_classe_1: 2_000,
          area_ha_classe_2: 18_000,
          media_Carbono: 12.5,
        },
      ],
      2,
    );

    expect(result.patch.locations).toEqual({
      "2507507": "João Pessoa - PB",
    });
    expect(result.patch.years?.["2020-01"]?.values?.["2507507"]).toEqual([
      10, 90,
    ]);
    expect(result.metrics["2507507"]).toMatchObject({
      areaTotalHa: 20_000,
      classAreaHa: [2_000, 18_000],
      mean: 12.5,
    });
  });

  it("uses the canonical multilevel location key", () => {
    const result = mapGeeStatisticsRows(
      source,
      schema,
      "2020-01",
      "4_asd-asd-entorno",
      [
        {
          NIVEL_AGRUPAMENTO: "4_ASD",
          NOME_LOCAL: "ASD + Entorno",
          perc_classe_1: 30,
          perc_classe_2: 70,
        },
        {
          NIVEL_AGRUPAMENTO: "4_ASD",
          NOME_LOCAL: "Apenas ASD",
          perc_classe_1: 80,
          perc_classe_2: 20,
        },
      ],
      2,
    );

    expect(result.patch.years?.["2020-01"]?.values).toEqual({
      "4_asd-asd-entorno": [30, 70],
    });
  });

  it.each([
    ["2_Regiao", "Nordeste", "2_regiao-nordeste"],
    ["3_Bioma", "Caatinga", "3_bioma-caatinga"],
    ["4_ASD", "ASD + Entorno", "4_asd-asd-entorno"],
    ["5_Semiarido", "Semiárido Total", "5_semiarido-semiarido-total"],
  ])("maps aggregate level %s without geometry", (level, name, key) => {
    const result = mapGeeStatisticsRows(
      source,
      schema,
      "2020-01",
      key,
      [
        {
          NIVEL_AGRUPAMENTO: level,
          NOME_LOCAL: name,
          perc_classe_1: 35,
          perc_classe_2: 65,
          ".geo": { type: "Polygon", coordinates: [] },
        },
      ],
      2,
    );

    expect(result.patch.locations).toEqual({ [key]: name });
    expect(result.patch.years?.["2020-01"]?.values).toEqual({
      [key]: [35, 65],
    });
    expect(JSON.stringify(result.patch)).not.toContain("coordinates");
  });

  it("omits all-zero rows from available statistical values", () => {
    const result = mapGeeStatisticsRows(
      source,
      schema,
      "2020-01",
      "2605459",
      [
        {
          NIVEL_AGRUPAMENTO: "7_Municipio",
          NOME_LOCAL: "Fernando de Noronha",
          NM_UF: "PE",
          CD_MUN: "2605459",
          perc_classe_1: 0,
          perc_classe_2: 0,
        },
      ],
      2,
    );

    expect(result.patch.years?.["2020-01"]?.values).toEqual({});
    expect(result.omittedZeroValueLocationKeys).toEqual(["2605459"]);
  });

  it("rejects class-count drift and duplicate territorial rows", () => {
    expect(() =>
      mapGeeStatisticsRows(source, schema, "2020-01", "br", [], 3),
    ).toThrow("possui 2 classes, mas a camada possui 3");

    const duplicatedBrazil = {
      NIVEL_AGRUPAMENTO: "1_BR",
      NOME_LOCAL: "Brasil Total",
      perc_classe_1: 40,
      perc_classe_2: 60,
    };

    expect(() =>
      mapGeeStatisticsRows(
        source,
        schema,
        "2020-01",
        "br",
        [duplicatedBrazil, duplicatedBrazil],
        2,
      ),
    ).toThrow("localidade duplicada: br/2020-01");
  });

  it("rejects percentages with an incompatible scale or total", () => {
    const invalidBrazil = {
      NIVEL_AGRUPAMENTO: "1_BR",
      NOME_LOCAL: "Brasil",
      perc_classe_1: 0.4,
      perc_classe_2: 0.6,
    };

    expect(() =>
      mapGeeStatisticsRows(source, schema, "2020-01", "br", [invalidBrazil], 2),
    ).toThrow("esperado 100 ± 0.2");
  });
});

describe("seleção do período entre as linhas do território", () => {
  // A leitura no Earth Engine passou a trazer o território inteiro de uma vez,
  // então é esta função que escolhe o período. Errar aqui mostra o mês errado
  // no painel sem levantar erro nenhum.
  it("casa o mês pelo primeiro dia gravado em data_img", () => {
    const row = { data_img: "2025-06-01", ano: 2025 };

    expect(matchesStatisticsPeriod(source, row, "2025-06")).toBe(true);
    expect(matchesStatisticsPeriod(source, row, "2025-07")).toBe(false);
    expect(matchesStatisticsPeriod(source, row, "2024-06")).toBe(false);
  });

  it("casa o ano em fontes anuais, mesmo quando ano vem como texto", () => {
    const annualSource: ResolvedGeeStatisticsSource = {
      ...source,
      periodGranularity: "year",
    };

    expect(matchesStatisticsPeriod(annualSource, { ano: 2020 }, "2020")).toBe(
      true,
    );
    expect(matchesStatisticsPeriod(annualSource, { ano: "2020" }, "2020")).toBe(
      true,
    );
    expect(matchesStatisticsPeriod(annualSource, { ano: 2021 }, "2020")).toBe(
      false,
    );
  });

  it("descarta a linha quando a propriedade do período não veio", () => {
    expect(matchesStatisticsPeriod(source, {}, "2025-06")).toBe(false);
  });
});
