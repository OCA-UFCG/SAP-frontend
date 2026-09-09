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

  // Regressão: o catálogo recusava
  // Estatisticas_IA_atlas_BR_DWGD_1990 com "deve iniciar as classes em 0 ou 1;
  // recebeu 2", embora o schema fosse contíguo e utilizável.
  it("accepts a contiguous class schema that starts outside 0 or 1", () => {
    const source = getResolvedSource();
    const schema = inferGeeStatisticsSchema(
      source,
      getPropertyNames([4, 2, 3]),
    );

    expect(schema.classIndexes).toEqual([2, 3, 4]);
    expect(schema.percentageProperties).toEqual([
      "perc_classe_2",
      "perc_classe_3",
      "perc_classe_4",
    ]);
    expect(schema.classAreaProperties).toEqual([
      "area_ha_classe_2",
      "area_ha_classe_3",
      "area_ha_classe_4",
    ]);
  });

  it("rejects missing or mismatched class columns", () => {
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
    ).toThrow("não tem o par de todas as classes: area_ha_classe_1");
  });

  // Regressão: a validação parava no primeiro problema, então quem cadastrou o
  // Municipios_S2ID_corrigido descobria que faltava perc_classe_XX e só depois,
  // uma validação por vez, que o mapeamento territorial também não existia.
  it("reports every column problem at once, with the columns the asset has", () => {
    expect(() =>
      inferGeeStatisticsSchema(getResolvedSource(), [
        "CD_MUN",
        "NM_UF",
        "2024",
        "2025",
      ]),
    ).toThrow(
      /não possui colunas perc_classe_XX; não tem estas colunas do mapeamento: NIVEL_AGRUPAMENTO \(nível territorial\), NOME_LOCAL \(nome do território\), ano \(ano\), data_img \(data\), area_total_ha \(área total\)/u,
    );
  });

  it("points a period-column asset at the single-value shape", () => {
    expect(() =>
      inferGeeStatisticsSchema(getResolvedSource(), ["CD_MUN", "2024", "2025"]),
    ).toThrow("Valor único por município");
  });

  it("names the scalar metric column that the asset does not have", () => {
    const source = getResolvedSource({
      properties: { ...standardProperties, scalarMetrics: { mean: "media" } },
    });

    expect(() =>
      inferGeeStatisticsSchema(source, getPropertyNames([0])),
    ).toThrow("media (média)");
  });

  // A cobertura do solo do IBGE usa as classes 1 a 6 e 9 a 14: 7 e 8 não
  // existem na legenda dela. Exigir sequência contígua rejeitava o asset sem
  // que nada a jusante precisasse disso — tudo é posicional.
  it("accepts a class schema with gaps in the sequence", () => {
    const indexes = [1, 2, 3, 4, 5, 6, 9, 10, 11, 12, 13, 14];
    const schema = inferGeeStatisticsSchema(
      getResolvedSource(),
      getPropertyNames([...indexes].reverse()),
    );

    expect(schema.classIndexes).toEqual(indexes);
    expect(schema.percentageProperties).toEqual(
      indexes.map((index) => `perc_classe_${index}`),
    );
    expect(schema.classAreaProperties).toEqual(
      indexes.map((index) => `area_ha_classe_${index}`),
    );
  });

  it("still rejects a gapped schema whose area columns do not match", () => {
    expect(() =>
      inferGeeStatisticsSchema(getResolvedSource(), [
        ...Object.values(standardProperties),
        "perc_classe_1",
        "perc_classe_9",
        "area_ha_classe_1",
        "area_ha_classe_8",
      ]),
    ).toThrow(
      "não tem o par de todas as classes: area_ha_classe_9, perc_classe_8",
    );
  });

  it("still rejects a duplicated class index", () => {
    expect(() =>
      inferGeeStatisticsSchema(getResolvedSource(), [
        ...Object.values(standardProperties),
        "perc_classe_09",
        "perc_classe_9",
        "area_ha_classe_9",
      ]),
    ).toThrow("índice de classe duplicado");
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
