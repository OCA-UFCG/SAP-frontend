import { describe, expect, it } from "vitest";

import { parseMunicipalSpreadsheetSnapshot } from "@/contracts/municipalSpreadsheetSnapshot";
import { aggregateMunicipalSpreadsheet } from "@/utils/municipalSpreadsheetAggregation";
import type { MunicipalSpreadsheetRow } from "@/utils/municipalSpreadsheetTable";

const PERIODS = ["2010", "2020"];
const GENERATED_AT = "2026-09-18T12:00:00.000Z";

function buildRow(
  overrides: Partial<MunicipalSpreadsheetRow> = {},
): MunicipalSpreadsheetRow {
  return {
    municipalityCode: "2507507",
    label: "João Pessoa - PB",
    stateCode: "PB",
    stateName: "Paraíba",
    region: "Nordeste",
    biome: "Mata Atlântica",
    isSemiarid: false,
    isAsdOrSurroundings: true,
    values: [10, 20],
    ...overrides,
  };
}

describe("aggregateMunicipalSpreadsheet", () => {
  const rows = [
    buildRow(),
    buildRow({
      municipalityCode: "2504009",
      label: "Campina Grande - PB",
      isSemiarid: true,
      values: [30, 40],
    }),
    buildRow({
      municipalityCode: "3550308",
      label: "São Paulo - SP",
      stateCode: "SP",
      stateName: "São Paulo",
      region: "Sudeste",
      biome: "Cerrado",
      isAsdOrSurroundings: false,
      values: [100, null],
    }),
  ];

  it("sums the municipalities into every territorial cut the sheet allows", () => {
    const { snapshot } = aggregateMunicipalSpreadsheet(
      rows,
      PERIODS,
      "sum",
      GENERATED_AT,
    );

    expect(snapshot.values.br).toEqual([140, 60]);
    expect(snapshot.values.pb).toEqual([40, 60]);
    expect(snapshot.values.sp).toEqual([100, null]);
    expect(snapshot.values["2_regiao-nordeste"]).toEqual([40, 60]);
    expect(snapshot.values["3_bioma-mata-atlantica"]).toEqual([40, 60]);
    expect(snapshot.values["4_asd-asd-entorno"]).toEqual([40, 60]);
    expect(snapshot.values["5_semiarido-semiarido-total"]).toEqual([30, 40]);
  });

  it("averages instead of summing when the indicator is not summable", () => {
    const { snapshot } = aggregateMunicipalSpreadsheet(
      rows,
      PERIODS,
      "mean",
      GENERATED_AT,
    );

    expect(snapshot.values.br?.[0]).toBeCloseTo(140 / 3);
    // Só dois municípios têm valor em 2020, e a média é sobre eles.
    expect(snapshot.values.br?.[1]).toBe(30);
  });

  it("keeps each municipality's own values untouched", () => {
    const { snapshot } = aggregateMunicipalSpreadsheet(
      rows,
      PERIODS,
      "sum",
      GENERATED_AT,
    );

    expect(snapshot.values["3550308"]).toEqual([100, null]);
    expect(snapshot.locations["3550308"]).toBe("São Paulo - SP");
    expect(snapshot.locations.pb).toBe("Paraíba");
  });

  it("counts the municipalities missing a value in each period", () => {
    const { missingByPeriod } = aggregateMunicipalSpreadsheet(
      rows,
      PERIODS,
      "sum",
      GENERATED_AT,
    );

    expect(missingByPeriod).toEqual({ "2010": 0, "2020": 1 });
  });

  it("counts the municipalities whose state it could not resolve", () => {
    const { unknownStateCount, snapshot } = aggregateMunicipalSpreadsheet(
      [buildRow({ stateCode: "XX", stateName: "" })],
      PERIODS,
      "sum",
      GENERATED_AT,
    );

    expect(unknownStateCount).toBe(1);
    expect(snapshot.values.xx).toBeUndefined();
  });

  it("produces a snapshot the runtime contract accepts", () => {
    const { snapshot } = aggregateMunicipalSpreadsheet(
      rows,
      PERIODS,
      "sum",
      GENERATED_AT,
    );

    expect(parseMunicipalSpreadsheetSnapshot(snapshot).generatedAt).toBe(
      GENERATED_AT,
    );
  });
});

describe("parseMunicipalSpreadsheetSnapshot", () => {
  const valid = {
    schemaVersion: 1,
    type: "municipal-spreadsheet-snapshot",
    generatedAt: GENERATED_AT,
    periods: ["2010"],
    aggregation: "sum",
    locations: { br: "Brasil" },
    values: { br: [1] },
  };

  it("refuses a value list that does not line up with the periods", () => {
    expect(() =>
      parseMunicipalSpreadsheetSnapshot({
        ...valid,
        periods: ["2010", "2020"],
        values: { br: [1] },
      }),
    ).toThrow(/values.br deve ter 2/u);
  });

  it("refuses an unknown aggregation and a missing type", () => {
    expect(() =>
      parseMunicipalSpreadsheetSnapshot({ ...valid, aggregation: "median" }),
    ).toThrow(/sum ou mean/u);
    expect(() =>
      parseMunicipalSpreadsheetSnapshot({ ...valid, type: "outra-coisa" }),
    ).toThrow(/municipal-spreadsheet-snapshot/u);
  });
});
