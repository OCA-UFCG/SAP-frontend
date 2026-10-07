import { describe, expect, it } from "vitest";

import {
  buildColumnDiagnosis,
  describeAssetColumns,
  splitAssetColumns,
  suggestStatisticsShape,
} from "@/contracts/geeStatisticsColumns";

// As colunas reais do Municipios_S2ID_corrigido, o asset que motivou o
// diagnóstico: 23 anos como colunas afogavam as colunas territoriais.
const S2ID_COLUMNS = [
  "system:index",
  "AREA_KM2",
  "CD_CONCURB",
  "CD_MUN",
  "CD_REGIAO",
  "CD_RGI",
  "CD_RGINT",
  "CD_UF",
  "Codigo_IBG",
  "NM_CONCURB",
  "NM_MUN",
  "NM_REGIAO",
  "NM_RGI",
  "NM_RGINT",
  "NM_UF",
  "Nome_Munic",
  "SIGLA_RG",
  "SIGLA_UF",
  "UF",
  "suma",
  ...Array.from({ length: 23 }, (_item, index) => String(2004 + index)),
];

describe("splitAssetColumns", () => {
  it("separates the period columns from the ones a mapping can use", () => {
    const { plain, periods } = splitAssetColumns(["NM_MUN", "2025", "2024"]);

    expect(plain).toEqual(["NM_MUN"]);
    expect(periods).toEqual(["2024", "2025"]);
  });

  it("drops the Earth Engine column nobody maps", () => {
    expect(splitAssetColumns(["system:index", "CD_MUN"]).plain).toEqual([
      "CD_MUN",
    ]);
  });

  it("reads a monthly column as a period", () => {
    expect(splitAssetColumns(["2024-01", "2024-13"]).periods).toEqual([
      "2024-01",
    ]);
  });
});

describe("describeAssetColumns", () => {
  it("summarizes the period columns instead of listing every year", () => {
    const description = describeAssetColumns(S2ID_COLUMNS);

    expect(description).toContain("CD_MUN");
    expect(description).toContain("23 colunas de período (2004 a 2026)");
    // O bloco territorial cabe inteiro: é nele que está a coluna procurada.
    expect(description).toContain("SIGLA_UF");
    expect(description).not.toContain("2011");
  });

  it("counts the columns that do not fit the list", () => {
    const description = describeAssetColumns(
      Array.from({ length: 26 }, (_item, index) => `coluna_${index}`),
    );

    expect(description).toContain("e mais 6");
  });

  it("names a lone period column instead of counting it", () => {
    expect(describeAssetColumns(["CD_MUN", "2024"])).toBe(
      "Colunas do asset: CD_MUN. Além delas, a coluna de período 2024.",
    );
  });

  it("says so when the asset has no column at all", () => {
    expect(describeAssetColumns(["system:index"])).toBe(
      "O asset não tem nenhuma coluna.",
    );
  });
});

describe("suggestStatisticsShape", () => {
  it("points a period-column asset at the single-value shape", () => {
    expect(suggestStatisticsShape("classes", S2ID_COLUMNS)).toContain(
      "Valor único por município",
    );
  });

  it("points a perc_classe asset at the class-distribution shape", () => {
    expect(
      suggestStatisticsShape("value", ["perc_classe_1", "area_ha_classe_1"]),
    ).toContain("Distribuição por classes");
  });

  it("stays quiet when the columns do not suggest the other shape", () => {
    expect(suggestStatisticsShape("classes", ["CD_MUN", "2024"])).toBeNull();
    expect(suggestStatisticsShape("value", ["CD_MUN", "2024"])).toBeNull();
  });
});

describe("buildColumnDiagnosis", () => {
  it("joins every problem, the real columns and the shape hint", () => {
    const message = buildColumnDiagnosis({
      assetId: "projects/x/assets/Municipios_S2ID_corrigido",
      problems: [
        "não possui colunas perc_classe_XX",
        "não tem estas colunas do mapeamento: ano (ano)",
      ],
      columnNames: S2ID_COLUMNS,
      shape: "classes",
    });

    expect(message).toContain("projects/x/assets/Municipios_S2ID_corrigido");
    expect(message).toContain("perc_classe_XX; não tem estas colunas");
    expect(message).toContain("Colunas do asset:");
    expect(message).toContain("Valor único por município");
  });
});
