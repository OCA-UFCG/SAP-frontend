import { describe, expect, it } from "vitest";

import type { GeeMunicipalValueTableStatisticsSource } from "@/contracts/geeMunicipalValueTable";
import {
  buildMunicipalityRow,
  buildStateRow,
  mapMunicipalValueRows,
  toSingleValuesByPeriod,
  toValuesByPeriod,
} from "@/repositories/platform/geeMunicipalValueTable";

const source: GeeMunicipalValueTableStatisticsSource = {
  kind: "gee-municipal-value-table",
  asset: { type: "fixed", assetId: "projects/example/assets/pob_total" },
  periodGranularity: "year",
  valueProperty: "{year}",
  aggregation: "mean",
  properties: {
    municipalityCode: "CD_MUN",
    locationName: "NM_MUN",
    stateCode: "SIGLA_UF",
  },
};

describe("municipal value table mapping", () => {
  it("labels a municipality with its state acronym", () => {
    const row = buildMunicipalityRow(
      source,
      { CD_MUN: "2507507", NM_MUN: "João Pessoa", SIGLA_UF: "PB" },
      { "2024": 51.2 },
    );

    expect(row).toEqual({
      locationKey: "2507507",
      label: "João Pessoa - PB",
      valuesByPeriod: { "2024": 51.2 },
    });
  });

  it("refuses a row without a usable IBGE code", () => {
    expect(() =>
      buildMunicipalityRow(source, { CD_MUN: "250", NM_MUN: "X" }, {}),
    ).toThrow("sem código IBGE válido");
  });

  it("accepts the state column written as an acronym or as a name", () => {
    expect(buildStateRow("PB", { "2024": 1 })).toEqual({
      locationKey: "pb",
      label: "Paraíba",
      valuesByPeriod: { "2024": 1 },
    });
    expect(buildStateRow("Paraíba", {})?.locationKey).toBe("pb");
    expect(buildStateRow("Nordeste", {})).toBeNull();
  });

  it("reads the aggregated values in the order the columns were asked", () => {
    expect(toValuesByPeriod(["2023", "2024"], [10, 20])).toEqual({
      "2023": 10,
      "2024": 20,
    });
    expect(toValuesByPeriod(["2023", "2024"], [10])).toEqual({
      "2023": 10,
      "2024": null,
    });
  });

  it("reads a municipal row by the column of each period", () => {
    expect(
      toSingleValuesByPeriod(
        ["2023", "2024"],
        { a: 7, b: "" },
        {
          "2023": "a",
          "2024": "b",
        },
      ),
    ).toEqual({ "2023": 7, "2024": null });
  });

  it("keeps Brazil and every state in the national slice", () => {
    const patch = mapMunicipalValueRows(
      [
        { locationKey: "br", label: "Brasil", valuesByPeriod: { "2024": 742 } },
        { locationKey: "pb", label: "Paraíba", valuesByPeriod: { "2024": 34 } },
        {
          locationKey: "2507507",
          label: "João Pessoa - PB",
          valuesByPeriod: { "2024": 1 },
        },
      ],
      "2024",
      "br",
    );

    expect(patch.locations).toEqual({ br: "Brasil", pb: "Paraíba" });
    expect(patch.years?.["2024"]?.values).toEqual({ br: [742], pb: [34] });
  });

  it("narrows the patch to the requested municipality", () => {
    const patch = mapMunicipalValueRows(
      [
        {
          locationKey: "2507507",
          label: "João Pessoa - PB",
          valuesByPeriod: { "2024": 51.2 },
        },
      ],
      "2024",
      "2507507",
    );

    expect(patch.years?.["2024"]?.values).toEqual({ "2507507": [51.2] });
  });

  it("omits a territory whose period has no value instead of showing zero", () => {
    const patch = mapMunicipalValueRows(
      [
        {
          locationKey: "pb",
          label: "Paraíba",
          valuesByPeriod: { "2024": null },
        },
      ],
      "2024",
      "pb",
    );

    expect(patch.locations).toEqual({ pb: "Paraíba" });
    expect(patch.years?.["2024"]?.values).toEqual({});
  });
});
