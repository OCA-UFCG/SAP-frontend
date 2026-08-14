import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@google/earthengine", () => ({ default: {} }));
vi.mock("@/infrastructure/earth-engine/client", () => ({
  evaluateGeeObject: vi.fn(),
  initializeGee: vi.fn(),
}));

import type { GeeFeatureCollectionStatisticsSource } from "@/config/geeStatistics";
import { mapGeeStatisticsRows } from "@/repositories/platform/geeStatisticsRepository";

const source: GeeFeatureCollectionStatisticsSource = {
  kind: "gee-feature-collection",
  assetId: "projects/example/assets/statistics",
  levelProperty: "NIVEL_AGRUPAMENTO",
  locationNameProperty: "NOME_LOCAL",
  municipalityCodeProperty: "CD_MUN",
  stateCodeProperty: "NM_UF",
  yearProperty: "ano",
  dateProperty: "data_img",
  classProperties: ["perc_classe_1", "perc_classe_2"],
  metricProperties: ["area_total_ha", "media_Carbono"],
};

describe("geeStatisticsRepository mapping", () => {
  it("maps Brazil and state rows for the national ranking slice", () => {
    const result = mapGeeStatisticsRows(
      source,
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
      mean: 12.5,
    });
  });

  it("uses the canonical multilevel location key", () => {
    const result = mapGeeStatisticsRows(
      source,
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

  it("omits all-zero rows from available statistical values", () => {
    const result = mapGeeStatisticsRows(
      source,
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
    expect(() => mapGeeStatisticsRows(source, "2020-01", "br", [], 3)).toThrow(
      "possui 2 classes, mas a camada possui 3",
    );

    const duplicatedBrazil = {
      NIVEL_AGRUPAMENTO: "1_BR",
      NOME_LOCAL: "Brasil Total",
      perc_classe_1: 40,
      perc_classe_2: 60,
    };

    expect(() =>
      mapGeeStatisticsRows(
        source,
        "2020-01",
        "br",
        [duplicatedBrazil, duplicatedBrazil],
        2,
      ),
    ).toThrow("localidade duplicada: br/2020-01");
  });
});
