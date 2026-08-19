import { describe, expect, it } from "vitest";

import {
  getGeeStatisticsRequestedProperties,
  inferGeeStatisticsSchema,
  parsePublishedGeeStatisticsSource,
  resolveGeeStatisticsSource,
} from "@/contracts/geeStatistics";
import type {
  GeeFeatureCollectionStatisticsSource,
  ResolvedGeeStatisticsSource,
} from "@/contracts/geeStatistics";

const standardProperties = {
  level: "NIVEL_AGRUPAMENTO",
  locationName: "NOME_LOCAL",
  municipalityCode: "CD_MUN",
  stateCode: "NM_UF",
  year: "ano",
  date: "data_img",
  totalArea: "area_total_ha",
};

function getPropertyNames(classIndexes: number[]): string[] {
  return [
    ...Object.values(standardProperties),
    ...classIndexes.map((classIndex) => `perc_classe_${classIndex}`),
    ...classIndexes.map((classIndex) => `area_ha_classe_${classIndex}`),
  ];
}

function getResolvedSource(
  overrides: Partial<ResolvedGeeStatisticsSource> = {},
): ResolvedGeeStatisticsSource {
  return {
    kind: "gee-feature-collection",
    asset: {
      type: "fixed",
      assetId: "projects/example/assets/statistics",
    },
    assetId: "projects/example/assets/statistics",
    periodGranularity: "year",
    properties: standardProperties,
    ...overrides,
  };
}

describe("GEE statistics contract", () => {
  it("infers and numerically orders the zero-based ANA class schema", () => {
    const source = getResolvedSource();
    const schema = inferGeeStatisticsSchema(
      source,
      getPropertyNames([5, 0, 3, 1, 4, 2]),
    );

    expect(schema.classIndexes).toEqual([0, 1, 2, 3, 4, 5]);
    expect(schema.percentageProperties).toEqual([
      "perc_classe_0",
      "perc_classe_1",
      "perc_classe_2",
      "perc_classe_3",
      "perc_classe_4",
      "perc_classe_5",
    ]);
    expect(getGeeStatisticsRequestedProperties(source, schema)).toContain(
      "area_ha_classe_0",
    );
  });

  it("accepts the one-based class schema used by carbon assets", () => {
    const schema = inferGeeStatisticsSchema(
      getResolvedSource(),
      getPropertyNames([1, 2, 3, 4, 5, 6]),
    );

    expect(schema.classIndexes).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("rejects missing, mismatched or non-contiguous class columns", () => {
    expect(() =>
      inferGeeStatisticsSchema(getResolvedSource(), [
        ...Object.values(standardProperties),
        "perc_class_0",
        "area_ha_classe_0",
      ]),
    ).toThrow("não possui colunas perc_classe_XX");

    expect(() =>
      inferGeeStatisticsSchema(getResolvedSource(), [
        ...Object.values(standardProperties),
        "perc_classe_0",
        "perc_classe_1",
        "area_ha_classe_0",
      ]),
    ).toThrow("mesmo conjunto");

    expect(() =>
      inferGeeStatisticsSchema(getResolvedSource(), getPropertyNames([0, 2])),
    ).toThrow("lacuna na sequência");
  });

  it("resolves a year-partitioned monthly source without configuration changes", () => {
    const source: GeeFeatureCollectionStatisticsSource = {
      kind: "gee-feature-collection",
      asset: {
        type: "period-template",
        assetIdTemplate: "projects/example/assets/MonitorANA_{year}",
      },
      periodGranularity: "month",
      properties: standardProperties,
    };

    expect(resolveGeeStatisticsSource(source, "2025-03").assetId).toBe(
      "projects/example/assets/MonitorANA_2025",
    );
    expect(() => resolveGeeStatisticsSource(source, "2025")).toThrow(
      "incompatível com granularidade month",
    );
  });

  it("keeps fixed annual assets strict about their period format", () => {
    const source = getResolvedSource();

    expect(resolveGeeStatisticsSource(source, "2020").assetId).toBe(
      source.assetId,
    );
    expect(() => resolveGeeStatisticsSource(source, "2020-01")).toThrow(
      "incompatível com granularidade year",
    );
  });

  it("validates untrusted statisticsSource objects from Contentful", () => {
    expect(
      parsePublishedGeeStatisticsSource({
        schemaVersion: 1,
        sourceRevision: "a".repeat(64),
        kind: "gee-feature-collection",
        asset: {
          type: "fixed",
          assetId: "projects/example/assets/statistics",
        },
        periodGranularity: "year",
        properties: standardProperties,
      }).sourceRevision,
    ).toHaveLength(64);
    expect(() =>
      parsePublishedGeeStatisticsSource({
        schemaVersion: 1,
        sourceRevision: "manual",
        kind: "gee-feature-collection",
        asset: { type: "fixed", assetId: "projects/x/assets/y" },
        periodGranularity: "year",
        properties: standardProperties,
      }),
    ).toThrow("Revisão");
  });
});
