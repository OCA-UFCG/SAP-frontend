import { describe, expect, it } from "vitest";

import {
  buildAmfeSheetValueRows,
  collectColumnValues,
  countStatesWithValue,
  findUndescribedColumns,
  parseAmfeSheetTable,
} from "@/repositories/platform/amfeSheetTable";

const dataRows = [
  {
    CD_MUN: "2507507",
    NM_MUN: "João Pessoa",
    SIGLA_UF: "PB",
    NM_REGIAO: "Nordeste",
    AREA_KM2: 211,
    ips: 60,
    pobreza_rural_2021: 40,
  },
  {
    CD_MUN: "2504009",
    NM_MUN: "Campina Grande",
    SIGLA_UF: "PB",
    NM_REGIAO: "Nordeste",
    AREA_KM2: 594,
    ips: 50,
    pobreza_rural_2021: "",
  },
  {
    CD_MUN: "3550308",
    NM_MUN: "São Paulo",
    SIGLA_UF: "SP",
    NM_REGIAO: "Sudeste",
    AREA_KM2: 1521,
    ips: 70,
    pobreza_rural_2021: 10,
  },
];

const metadataRows = [
  { id: "ips", título: "Índice de Progresso Social", descrição: "…" },
  { id: "pobreza_rural_2021", título: "Pobreza Rural", unit: "%" },
  { id: "criterio_sem_coluna", título: "Fantasma" },
];

const table = parseAmfeSheetTable(dataRows, metadataRows);

describe("parseAmfeSheetTable", () => {
  it("keeps only the criteria that exist as a column in the data tab", () => {
    expect(table.criteria.map((criterion) => criterion.column)).toEqual([
      "ips",
      "pobreza_rural_2021",
    ]);
    expect(table.criteria[1].unit).toBe("%");
  });

  it("reads one municipality per row, with an empty cell as no value", () => {
    expect(table.municipalities).toHaveLength(3);
    expect(table.municipalities[1]).toEqual({
      code: "2504009",
      name: "Campina Grande",
      stateCode: "PB",
      values: { ips: 50, pobreza_rural_2021: null },
    });
  });

  it("drops a row whose IBGE code is not a municipality", () => {
    const withTotal = parseAmfeSheetTable(
      [...dataRows, { CD_MUN: "TOTAL", NM_MUN: "Brasil", ips: 1 }],
      metadataRows,
    );

    expect(withTotal.municipalities).toHaveLength(3);
  });

  it("lists data columns that no criterion describes", () => {
    expect(findUndescribedColumns(dataRows, table.criteria)).toEqual([]);
    expect(
      findUndescribedColumns(
        [{ ...dataRows[0], coluna_nova: 1 }],
        table.criteria,
      ),
    ).toEqual(["coluna_nova"]);
  });
});

describe("buildAmfeSheetValueRows", () => {
  it("averages the municipalities into each state and Brazil", () => {
    const rows = buildAmfeSheetValueRows(table, "ips", "2024", "mean");

    expect(rows[0]).toEqual({
      locationKey: "br",
      label: "Brasil",
      valuesByPeriod: { "2024": 60 },
    });
    expect(
      rows.find((row) => row.locationKey === "pb")?.valuesByPeriod,
    ).toEqual({ "2024": 55 });
    expect(
      rows.find((row) => row.locationKey === "sp")?.valuesByPeriod,
    ).toEqual({ "2024": 70 });
  });

  it("sums the municipalities when the indicator is a count", () => {
    const rows = buildAmfeSheetValueRows(table, "ips", "2024", "sum");

    expect(rows[0].valuesByPeriod).toEqual({ "2024": 180 });
  });

  // Um município sem valor não pode derrubar a média da UF nem sumir do mapa:
  // ele entra como linha sem valor, que o painel mostra como "sem dado".
  it("keeps a municipality without value out of the aggregation", () => {
    const rows = buildAmfeSheetValueRows(
      table,
      "pobreza_rural_2021",
      "2024",
      "mean",
    );

    expect(
      rows.find((row) => row.locationKey === "pb")?.valuesByPeriod,
    ).toEqual({ "2024": 40 });
    expect(
      rows.find((row) => row.locationKey === "2504009")?.valuesByPeriod,
    ).toEqual({ "2024": null });
  });

  it("labels the municipality with its state acronym", () => {
    const rows = buildAmfeSheetValueRows(table, "ips", "2024", "mean");

    expect(rows.find((row) => row.locationKey === "2507507")?.label).toBe(
      "João Pessoa - PB",
    );
  });
});

describe("column statistics", () => {
  it("collects only the numeric values of a column", () => {
    expect(collectColumnValues(table, "pobreza_rural_2021")).toEqual([40, 10]);
  });

  it("counts the states that have any value in the column", () => {
    expect(countStatesWithValue(table, "ips")).toBe(2);
    expect(countStatesWithValue(table, "pobreza_rural_2021")).toBe(2);
  });
});
