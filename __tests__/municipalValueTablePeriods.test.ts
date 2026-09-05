import { describe, expect, it } from "vitest";

import { resolveValueTablePeriodColumns } from "@/utils/municipalValueTablePeriods";

// As colunas reais de `projects/ee-ulissesalencar17/assets/Municipios_S2ID_corrigido`:
// os anos convivem com colunas territoriais e com uma coluna solta chamada "7".
const S2ID_COLUMNS = [
  "suma",
  "NM_MUN",
  "CD_MUN",
  "SIGLA_UF",
  "AREA_KM2",
  "7",
  "2004",
  "2005",
  "2024",
  "2025",
  "2026",
];

describe("resolveValueTablePeriodColumns", () => {
  it("reads one period per column of a wide yearly table", () => {
    const columns = resolveValueTablePeriodColumns(
      { assetId: "projects/example/assets/s2id" },
      "{year}",
      "year",
      S2ID_COLUMNS,
    );

    expect(columns.map((column) => column.periodKey)).toEqual([
      "2004",
      "2005",
      "2024",
      "2025",
      "2026",
    ]);
    expect(columns[0]).toEqual({ periodKey: "2004", column: "2004" });
  });

  it("ignores columns that are not a period", () => {
    const columns = resolveValueTablePeriodColumns(
      { assetId: "projects/example/assets/s2id" },
      "{year}",
      "year",
      S2ID_COLUMNS,
    );

    expect(
      columns.some((column) => ["7", "suma", "CD_MUN"].includes(column.column)),
    ).toBe(false);
  });

  it("takes the period from the asset name when the column is fixed", () => {
    const columns = resolveValueTablePeriodColumns(
      {
        assetId: "projects/example/assets/pob_2019",
        assetIdTemplate: "projects/example/assets/pob_{year}",
      },
      "valor",
      "year",
      ["valor", "CD_MUN"],
    );

    expect(columns).toEqual([{ periodKey: "2019", column: "valor" }]);
  });

  it("combines the year of the asset with the month of the column", () => {
    const columns = resolveValueTablePeriodColumns(
      {
        assetId: "projects/example/assets/renda_2025",
        assetIdTemplate: "projects/example/assets/renda_{year}",
      },
      "mes_{month}",
      "month",
      ["mes_01", "mes_02", "mes_13", "CD_MUN"],
    );

    expect(columns).toEqual([
      { periodKey: "2025-01", column: "mes_01" },
      { periodKey: "2025-02", column: "mes_02" },
    ]);
  });

  it("keeps a yearly table out of a monthly index", () => {
    expect(
      resolveValueTablePeriodColumns(
        { assetId: "projects/example/assets/s2id" },
        "{year}",
        "month",
        S2ID_COLUMNS,
      ),
    ).toEqual([]);
  });

  it("refuses two columns that claim the same period", () => {
    // Duas colunas com anos diferentes no prefixo, mas o mesmo `{period}` no
    // fim: as duas descrevem 2024, e escolher uma delas em silêncio mostraria o
    // número errado no painel.
    expect(() =>
      resolveValueTablePeriodColumns(
        { assetId: "projects/example/assets/s2id" },
        "v{year}_{period}",
        "year",
        ["v2024_2024", "v2025_2024"],
      ),
    ).toThrow("descrevem o mesmo período");
  });

  it("refuses an asset that does not match its own template", () => {
    expect(() =>
      resolveValueTablePeriodColumns(
        {
          assetId: "projects/example/assets/outro",
          assetIdTemplate: "projects/example/assets/pob_{year}",
        },
        "valor",
        "year",
        ["valor"],
      ),
    ).toThrow("não corresponde ao template");
  });
});
