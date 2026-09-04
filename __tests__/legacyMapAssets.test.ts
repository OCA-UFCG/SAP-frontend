import { describe, expect, it } from "vitest";

import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import {
  applyLegacyMapAssets,
  parseLegacyMapAssetsInput,
  readLegacyMapAssets,
  summarizeLegacyMapAssetsChange,
} from "@/utils/legacyMapAssets";

/**
 * Um legado com um asset por período, como `deg` e `terraibge` estão gravados.
 */
function perPeriodIndex(): CompactTerritorialAnalysisDataset {
  return {
    schemaVersion: 1,
    type: "territorial-compact",
    defaultYear: "2020",
    classes: [{ id: "c1", label: "Degradado", color: "#FF0000" }],
    locations: { br: "Brasil" },
    years: {
      "2018": {
        imageId: "projects/ee-oca/assets/deg_2018",
        values: { br: [12.5] },
        valuesScale: 10,
      },
      "2020": {
        imageId: "projects/ee-oca/assets/deg_2020",
        values: { br: [13.5] },
        valuesScale: 10,
      },
    },
  };
}

/**
 * Um legado de asset único com uma coluna por ano, como os três de pobreza:
 * catorze períodos apontando para a mesma FeatureCollection.
 */
function sharedAssetIndex(): CompactTerritorialAnalysisDataset {
  const index = perPeriodIndex();
  index.years["2018"].imageId = "projects/ee-oca/assets/pob_total";
  index.years["2020"].imageId = "projects/ee-oca/assets/pob_total";
  index.years["2018"].year = "2018";
  return index;
}

/** Um índice de previsão que tira o horizonte do fim do nome do asset. */
function forecastIndex(): CompactTerritorialAnalysisDataset {
  const index = perPeriodIndex();
  index.years = {
    "2026-04": {
      imageId: "projects/ee-oca/assets/previsao_P_cal_20260401_01",
      values: { br: [1] },
    },
  };
  return index;
}

describe("readLegacyMapAssets", () => {
  it("lista o asset de cada período na ordem em que estão gravados", () => {
    expect(readLegacyMapAssets(perPeriodIndex())).toEqual({
      rows: [
        { period: "2018", imageId: "projects/ee-oca/assets/deg_2018" },
        { period: "2020", imageId: "projects/ee-oca/assets/deg_2020" },
      ],
    });
  });

  it("avisa quando todos os períodos usam o mesmo asset, para a tela mostrar um campo só", () => {
    expect(readLegacyMapAssets(sharedAssetIndex())).toEqual({
      rows: [
        {
          period: "2018",
          imageId: "projects/ee-oca/assets/pob_total",
          year: "2018",
        },
        { period: "2020", imageId: "projects/ee-oca/assets/pob_total" },
      ],
      sharedImageId: "projects/ee-oca/assets/pob_total",
    });
  });
});

describe("parseLegacyMapAssetsInput", () => {
  it("aceita o id de uma coleção pública e o de um asset do projeto", () => {
    const input = parseLegacyMapAssetsInput({
      assets: [
        { period: "2001", imageId: " MODIS/061/MOD17A3HGF/2001_01_01 " },
        { period: "2002", imageId: "projects/ee-oca/assets/deg_2002" },
      ],
    });

    expect(input.assets[0].imageId).toBe("MODIS/061/MOD17A3HGF/2001_01_01");
    expect(input.assets[1].imageId).toBe("projects/ee-oca/assets/deg_2002");
  });

  it("recusa asset vazio, porque o período ficaria sem imagem para desenhar", () => {
    expect(() =>
      parseLegacyMapAssetsInput({
        assets: [{ period: "2001", imageId: "  " }],
      }),
    ).toThrow(/período 2001 não pode ficar vazio/u);
  });

  it("recusa um endereço da web colado no lugar do id", () => {
    expect(() =>
      parseLegacyMapAssetsInput({
        assets: [
          { period: "2001", imageId: "https://code.earthengine.google.com/x" },
        ],
      }),
    ).toThrow(/não um endereço da web/u);
  });

  it("recusa espaço no meio e barra sobrando, que o Earth Engine só reportaria como mapa em branco", () => {
    expect(() =>
      parseLegacyMapAssetsInput({
        assets: [{ period: "2001", imageId: "projects/ee oca/assets/deg" }],
      }),
    ).toThrow(/não pode ter espaços/u);
    expect(() =>
      parseLegacyMapAssetsInput({
        assets: [{ period: "2001", imageId: "projects//ee-oca/assets/deg" }],
      }),
    ).toThrow(/barra sobrando/u);
  });
});

describe("applyLegacyMapAssets", () => {
  it("troca o asset e preserva os valores territoriais do período", () => {
    const before = perPeriodIndex();
    const after = applyLegacyMapAssets(before, {
      assets: [
        { period: "2018", imageId: "projects/ee-oca/assets/deg_2018_v5" },
        { period: "2020", imageId: "projects/ee-oca/assets/deg_2020" },
      ],
    });

    expect(after.years["2018"].imageId).toBe(
      "projects/ee-oca/assets/deg_2018_v5",
    );
    expect(after.years["2018"].values).toEqual({ br: [12.5] });
    expect(after.years["2018"].valuesScale).toBe(10);
    expect(after.classes).toEqual(before.classes);
    expect(before.years["2018"].imageId).toBe(
      "projects/ee-oca/assets/deg_2018",
    );
  });

  it("recusa criar período, que apareceria no mapa com o painel de análise vazio", () => {
    expect(() =>
      applyLegacyMapAssets(perPeriodIndex(), {
        assets: [
          { period: "2018", imageId: "projects/ee-oca/assets/deg_2018" },
          { period: "2020", imageId: "projects/ee-oca/assets/deg_2020" },
          { period: "2022", imageId: "projects/ee-oca/assets/deg_2022" },
        ],
      }),
    ).toThrow(/períodos desconhecidos \[2022\]/u);
  });

  it("recusa remover período, porque os valores gravados nele não têm outra cópia", () => {
    expect(() =>
      applyLegacyMapAssets(perPeriodIndex(), {
        assets: [
          { period: "2018", imageId: "projects/ee-oca/assets/deg_2018" },
        ],
      }),
    ).toThrow(/Faltaram \[2020\]/u);
  });

  it("recusa a troca que mudaria o tempo de previsão lido do nome do asset", () => {
    expect(() =>
      applyLegacyMapAssets(forecastIndex(), {
        assets: [
          {
            period: "2026-04",
            imageId: "projects/ee-oca/assets/previsao_P_cal_20260401_03",
          },
        ],
      }),
    ).toThrow(/tira o tempo de previsão do fim do nome do asset/u);
  });

  it("aceita a troca de previsão que mantém o sufixo do horizonte", () => {
    const after = applyLegacyMapAssets(forecastIndex(), {
      assets: [
        {
          period: "2026-04",
          imageId: "projects/ee-oca/assets/previsao_P_cal_v2_20260401_01",
        },
      ],
    });

    expect(after.years["2026-04"].imageId).toContain("v2");
  });
});

describe("summarizeLegacyMapAssetsChange", () => {
  it("diz nada quando a tela reenviou o que já estava gravado", () => {
    const before = perPeriodIndex();
    expect(summarizeLegacyMapAssetsChange(before, perPeriodIndex())).toBe(
      "nada",
    );
  });

  it("nomeia o período quando só um mudou, e conta quando foram vários", () => {
    const before = perPeriodIndex();
    const one = applyLegacyMapAssets(before, {
      assets: [
        { period: "2018", imageId: "projects/ee-oca/assets/deg_2018_v5" },
        { period: "2020", imageId: "projects/ee-oca/assets/deg_2020" },
      ],
    });
    const both = applyLegacyMapAssets(before, {
      assets: [
        { period: "2018", imageId: "projects/ee-oca/assets/deg_2018_v5" },
        { period: "2020", imageId: "projects/ee-oca/assets/deg_2020_v5" },
      ],
    });

    expect(summarizeLegacyMapAssetsChange(before, one)).toBe(
      "o asset do período 2018",
    );
    expect(summarizeLegacyMapAssetsChange(before, both)).toBe(
      "o asset de 2 períodos",
    );
  });
});
