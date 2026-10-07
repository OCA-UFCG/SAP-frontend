import { describe, expect, it } from "vitest";

import {
  parseGeeMunicipalValueTableSource,
  resolveGeeMunicipalValueTableSource,
  type GeeMunicipalValueTableStatisticsSource,
} from "@/contracts/geeMunicipalValueTable";
import {
  parseGeeStatisticsSource,
  parsePublishedGeeStatisticsSource,
} from "@/contracts/geeStatistics";

const properties = {
  municipalityCode: "CD_MUN",
  locationName: "NM_MUN",
  stateCode: "SIGLA_UF",
};

const wideYearTable = {
  kind: "gee-municipal-value-table",
  asset: { type: "fixed", assetId: "projects/example/assets/pob_total" },
  periodGranularity: "year",
  valueProperty: "{year}",
  aggregation: "mean",
  properties,
};

describe("municipal value table contract", () => {
  it("accepts a wide table whose columns are the periods", () => {
    const source = parseGeeMunicipalValueTableSource(wideYearTable);

    expect(source.valueProperty).toBe("{year}");
    expect(source.aggregation).toBe("mean");
    expect(source.properties.municipalityCode).toBe("CD_MUN");
  });

  it("rejects a single table read always through the same column", () => {
    expect(() =>
      parseGeeMunicipalValueTableSource({
        ...wideYearTable,
        valueProperty: "suma",
      }),
    ).toThrow("é ela que separa os períodos");
  });

  it("accepts a fixed column when each asset is one period", () => {
    const source = parseGeeMunicipalValueTableSource({
      ...wideYearTable,
      asset: {
        type: "period-template",
        assetIdTemplate: "projects/example/assets/pob_{year}",
      },
      valueProperty: "valor",
    });

    expect(resolveGeeMunicipalValueTableSource(source, "2024")).toMatchObject({
      assetId: "projects/example/assets/pob_2024",
      valueColumn: "valor",
    });
  });

  it("rejects an aggregation the panel cannot compute", () => {
    expect(() =>
      parseGeeMunicipalValueTableSource({
        ...wideYearTable,
        aggregation: "weighted",
      }),
    ).toThrow("soma ou média");
  });

  it("resolves the column of the requested period", () => {
    const source = parseGeeMunicipalValueTableSource(wideYearTable);

    expect(resolveGeeMunicipalValueTableSource(source, "2004")).toMatchObject({
      assetId: "projects/example/assets/pob_total",
      valueColumn: "2004",
    });
    expect(() =>
      resolveGeeMunicipalValueTableSource(source, "2004-01"),
    ).toThrow("incompatível com granularidade year");
  });

  it("resolves a monthly column inside a per-year asset", () => {
    const source: GeeMunicipalValueTableStatisticsSource =
      parseGeeMunicipalValueTableSource({
        ...wideYearTable,
        asset: {
          type: "period-template",
          assetIdTemplate: "projects/example/assets/renda_{year}",
        },
        periodGranularity: "month",
        valueProperty: "mes_{month}",
      });

    expect(
      resolveGeeMunicipalValueTableSource(source, "2025-03"),
    ).toMatchObject({
      assetId: "projects/example/assets/renda_2025",
      valueColumn: "mes_03",
    });
  });

  it("routes the shared parsers by kind", () => {
    expect(parseGeeStatisticsSource(wideYearTable).kind).toBe(
      "gee-municipal-value-table",
    );
    expect(
      parsePublishedGeeStatisticsSource({
        ...wideYearTable,
        schemaVersion: 1,
        sourceRevision: "a".repeat(64),
      }),
    ).toMatchObject({ kind: "gee-municipal-value-table", schemaVersion: 1 });
  });

  it("keeps rejecting a published source without a valid revision", () => {
    expect(() =>
      parsePublishedGeeStatisticsSource({
        ...wideYearTable,
        schemaVersion: 1,
        sourceRevision: "nope",
      }),
    ).toThrow("Revisão");
  });
});
