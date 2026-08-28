import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResolvedGeeStatisticsSource } from "@/contracts/geeStatistics";
import {
  buildStatisticsAssetKey,
  clearStatisticsAssetCache,
  getOrValidateStatisticsAsset,
  type DiscoveredStatisticsAsset,
} from "@/services/indexCatalog/statisticsAssetCache";

const UPDATE_TIME = "2026-08-17T11:00:00Z";

function source(
  overrides: Partial<ResolvedGeeStatisticsSource> = {},
): ResolvedGeeStatisticsSource {
  return {
    kind: "gee-feature-collection",
    assetId: "projects/x/assets/statistics_2024",
    asset: { type: "fixed", assetId: "projects/x/assets/statistics_2024" },
    periodGranularity: "year",
    properties: {
      level: "NIVEL_AGRUPAMENTO",
      locationName: "NOME_LOCAL",
      municipalityCode: "CD_MUN",
      stateCode: "NM_UF",
      year: "ano",
      date: "data_img",
      totalArea: "area_total_ha",
    },
    ...overrides,
  } as ResolvedGeeStatisticsSource;
}

function discovered(
  assetId = "projects/x/assets/statistics_2024",
): DiscoveredStatisticsAsset {
  return {
    assetId,
    updateTime: UPDATE_TIME,
    schema: {
      classIndexes: [1],
      percentageProperties: ["perc_classe_1"],
      classAreaProperties: ["area_ha_classe_1"],
    },
    periods: ["2024"],
    rowCount: 10,
  };
}

describe("buildStatisticsAssetKey", () => {
  it("não devolve chave quando o asset não informa updateTime", () => {
    // Sem o carimbo não há como saber que a tabela não mudou; revalidar sempre
    // é preferível a arriscar publicar uma revisão velha.
    expect(buildStatisticsAssetKey(source(), undefined)).toBeUndefined();
  });

  it("muda quando o asset é reexportado", () => {
    expect(buildStatisticsAssetKey(source(), UPDATE_TIME)).not.toBe(
      buildStatisticsAssetKey(source(), "2026-08-18T09:00:00Z"),
    );
  });

  it("muda quando o mapeamento de propriedades muda", () => {
    const other = source({
      properties: { ...source().properties, date: "data_referencia" },
    });
    expect(buildStatisticsAssetKey(other, UPDATE_TIME)).not.toBe(
      buildStatisticsAssetKey(source(), UPDATE_TIME),
    );
  });

  it("muda quando a granularidade muda", () => {
    expect(
      buildStatisticsAssetKey(
        source({ periodGranularity: "month" }),
        UPDATE_TIME,
      ),
    ).not.toBe(buildStatisticsAssetKey(source(), UPDATE_TIME));
  });

  it("não depende da ordem em que as propriedades foram escritas", () => {
    const { level, locationName, ...rest } = source().properties;
    const reordered = source({
      properties: { ...rest, locationName, level },
    });
    expect(buildStatisticsAssetKey(reordered, UPDATE_TIME)).toBe(
      buildStatisticsAssetKey(source(), UPDATE_TIME),
    );
  });
});

describe("getOrValidateStatisticsAsset", () => {
  beforeEach(() => {
    clearStatisticsAssetCache();
  });

  it("valida uma vez e reaproveita o resultado na mesma revisão", async () => {
    const validate = vi.fn(async () => discovered());
    const key = buildStatisticsAssetKey(source(), UPDATE_TIME);

    await getOrValidateStatisticsAsset(key, validate);
    const second = await getOrValidateStatisticsAsset(key, validate);

    expect(validate).toHaveBeenCalledTimes(1);
    expect(second).toEqual(discovered());
  });

  it("valida de novo quando o asset foi reexportado", async () => {
    const validate = vi.fn(async () => discovered());

    await getOrValidateStatisticsAsset(
      buildStatisticsAssetKey(source(), UPDATE_TIME),
      validate,
    );
    await getOrValidateStatisticsAsset(
      buildStatisticsAssetKey(source(), "2026-08-18T09:00:00Z"),
      validate,
    );

    expect(validate).toHaveBeenCalledTimes(2);
  });

  it("valida sempre quando não há chave", async () => {
    const validate = vi.fn(async () => discovered());

    await getOrValidateStatisticsAsset(undefined, validate);
    await getOrValidateStatisticsAsset(undefined, validate);

    expect(validate).toHaveBeenCalledTimes(2);
  });

  it("compartilha uma validação em voo entre chamadas simultâneas", async () => {
    const validate = vi.fn(async () => discovered());
    const key = buildStatisticsAssetKey(source(), UPDATE_TIME);

    const [left, right] = await Promise.all([
      getOrValidateStatisticsAsset(key, validate),
      getOrValidateStatisticsAsset(key, validate),
    ]);

    expect(validate).toHaveBeenCalledTimes(1);
    expect(left).toBe(right);
  });

  it("não guarda uma validação que falhou", async () => {
    const validate = vi
      .fn<() => Promise<DiscoveredStatisticsAsset>>()
      .mockRejectedValueOnce(new Error("asset inválido"))
      .mockResolvedValueOnce(discovered());
    const key = buildStatisticsAssetKey(source(), UPDATE_TIME);

    await expect(getOrValidateStatisticsAsset(key, validate)).rejects.toThrow(
      "asset inválido",
    );
    await expect(getOrValidateStatisticsAsset(key, validate)).resolves.toEqual(
      discovered(),
    );
    expect(validate).toHaveBeenCalledTimes(2);
  });

  it("descarta as entradas mais antigas ao passar do teto", async () => {
    const validate = vi.fn(async () => discovered());
    const keyOf = (index: number) =>
      buildStatisticsAssetKey(
        source({ assetId: `projects/x/assets/statistics_${index}` }),
        UPDATE_TIME,
      );

    for (let index = 0; index <= 200; index++) {
      await getOrValidateStatisticsAsset(keyOf(index), validate);
    }
    // A entrada 0 foi descartada e precisa ser validada de novo; a última não.
    await getOrValidateStatisticsAsset(keyOf(0), validate);
    await getOrValidateStatisticsAsset(keyOf(200), validate);

    expect(validate).toHaveBeenCalledTimes(202);
  });
});
