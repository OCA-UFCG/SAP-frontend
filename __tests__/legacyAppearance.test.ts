import { describe, expect, it } from "vitest";

import type { CompactTerritorialAnalysisDataset } from "@/utils/analysis";
import {
  applyLegacyAppearance,
  assertOnlyAppearanceChanged,
  parseLegacyAppearanceInput,
  readLegacyAppearance,
  summarizeLegacyAppearanceChange,
} from "@/utils/legacyAppearance";

/**
 * Um índice legado classificatório, no formato em que `terraibge`,
 * `carbonoembrapa` e `deg` estão gravados: as classes são a legenda, os valores
 * de cada período são listas na ordem delas e `tone` traz as cores do chip do
 * painel de análise.
 */
function classifiedIndex(): CompactTerritorialAnalysisDataset {
  return {
    schemaVersion: 1,
    type: "territorial-compact",
    defaultYear: "2020",
    classes: [
      {
        id: "area-artificial",
        label: "Área artificial",
        color: "#FF0000",
        pixelLimit: 1,
        tone: { bg: "#FDE5E5", color: "#B80000", border: "#E6A0A0" },
      },
      {
        id: "area-agricola",
        label: "Área agrícola",
        color: "#EBE628",
        pixelLimit: 2,
        tone: { bg: "#FFFCE3", color: "#7B7600", border: "#E7E09A" },
      },
    ],
    locations: { br: "Brasil", "25": "Paraíba" },
    years: {
      "2018": {
        imageId: "assets/terra_2018",
        values: { br: [12.5, 87.5], "25": [10, 90] },
        valuesScale: 10,
      },
      "2020": {
        imageId: "assets/terra_2020",
        values: { br: [13.5, 86.5], "25": [11, 89] },
        valuesScale: 10,
      },
    },
  };
}

/**
 * Um índice de valor único, como `pob_total`: uma classe só (o nome da série) e
 * as faixas coloridas do mapa em `mapVisualization.legend`, com paleta e
 * limites numéricos.
 */
function singleValueIndex(): CompactTerritorialAnalysisDataset {
  return {
    schemaVersion: 1,
    type: "territorial-compact",
    defaultYear: "2024",
    classes: [
      {
        id: "familias-cadunico-pobreza",
        label: "Famílias em situação de pobreza",
        color: "#BD0026",
      },
    ],
    mapVisualization: {
      min: 1,
      max: 5,
      sourceType: "featureCollection",
      property: "{year}",
      legend: [
        { id: "0-20", label: "0-20", color: "#FFFFCC" },
        { id: "20-40", label: "20-40", color: "#FED976" },
        { id: "40-60", label: "40-60", color: "#FEB24C" },
      ],
      palette: ["#FFFFCC", "#FED976", "#FEB24C"],
      thresholds: [20, 40],
      sourceRange: { min: 0, max: 100, unit: "%" },
    },
    locations: { br: "Brasil" },
    years: {
      "2024": { imageId: "assets/pob", values: { br: [42.5] }, valuesScale: 1 },
    },
  };
}

/**
 * O formato de `cemadenseca`: as classes descem de `pixelLimit` 6 a 1 e a
 * paleta sobe de 1 a 6, na ordem inversa da legenda, escrita sem `#` e com as
 * cores em minúsculas nos legados em geral.
 */
function reversePaletteIndex(): CompactTerritorialAnalysisDataset {
  return {
    schemaVersion: 1,
    type: "territorial-compact",
    defaultYear: "2025",
    classes: [
      {
        id: "normais",
        label: "Condições normais",
        color: "#ffffff",
        pixelLimit: 3,
      },
      {
        id: "seca-fraca",
        label: "Seca fraca",
        color: "#fcff50",
        pixelLimit: 2,
      },
      {
        id: "seca-extrema",
        label: "Seca extrema",
        color: "#ca281b",
        pixelLimit: 1,
      },
    ],
    mapVisualization: {
      min: 1,
      max: 3,
      band: "target_class",
      palette: ["CA281B", "FCFF50", "FFFFFF"],
    },
    locations: { br: "Brasil" },
    years: {
      "2025": { imageId: "assets/cemaden", values: { br: [50, 30, 20] } },
    },
  };
}

describe("readLegacyAppearance", () => {
  it("usa as classes como legenda quando não há legenda própria", () => {
    const appearance = readLegacyAppearance(classifiedIndex());

    expect(appearance.legendSource).toBe("classes");
    expect(appearance.legend).toEqual([
      { id: "area-artificial", label: "Área artificial", color: "#FF0000" },
      { id: "area-agricola", label: "Área agrícola", color: "#EBE628" },
    ]);
    expect(appearance.series).toBeUndefined();
    expect(appearance.thresholds).toBeUndefined();
    expect(appearance.paletteLength).toBe(0);
  });

  it("separa faixas do mapa e série medida num índice de valor único", () => {
    const appearance = readLegacyAppearance(singleValueIndex());

    expect(appearance.legendSource).toBe("mapVisualization.legend");
    expect(appearance.legend.map((row) => row.id)).toEqual([
      "0-20",
      "20-40",
      "40-60",
    ]);
    expect(appearance.series).toEqual([
      {
        id: "familias-cadunico-pobreza",
        label: "Famílias em situação de pobreza",
        color: "#BD0026",
      },
    ]);
    expect(appearance.thresholds).toEqual([20, 40]);
    expect(appearance.thresholdUnit).toBe("%");
    expect(appearance.paletteLength).toBe(3);
  });
});

describe("parseLegacyAppearanceInput", () => {
  it("normaliza a cor e apara o rótulo", () => {
    const input = parseLegacyAppearanceInput({
      legend: [{ id: "c1", label: "  Seca fraca  ", color: "ca281b" }],
    });

    expect(input.legend).toEqual([
      { id: "c1", label: "Seca fraca", color: "#CA281B" },
    ]);
  });

  it("recusa rótulo em branco dizendo qual linha", () => {
    expect(() =>
      parseLegacyAppearanceInput({
        legend: [
          { id: "c1", label: "Seca", color: "#CA281B" },
          { id: "c2", label: "   ", color: "#FFFFFF" },
        ],
      }),
    ).toThrow(/legend\[1\]/u);
  });

  it("recusa cor que não é hexadecimal", () => {
    expect(() =>
      parseLegacyAppearanceInput({
        legend: [{ id: "c1", label: "Seca", color: "vermelho" }],
      }),
    ).toThrow(/#RRGGBB/u);
  });

  it("recusa limites fora de ordem crescente", () => {
    expect(() =>
      parseLegacyAppearanceInput({
        legend: [{ id: "c1", label: "Seca", color: "#CA281B" }],
        thresholds: [40, 20],
      }),
    ).toThrow(/ordem crescente/u);
  });
});

describe("applyLegacyAppearance", () => {
  it("grava rótulo e cor nas classes sem tocar nos valores dos períodos", () => {
    const before = classifiedIndex();
    const after = applyLegacyAppearance(before, {
      legend: [
        { id: "area-artificial", label: "Área urbanizada", color: "#FF0000" },
        { id: "area-agricola", label: "Área agrícola", color: "#00FF00" },
      ],
    });

    expect(after.classes[0].label).toBe("Área urbanizada");
    expect(after.classes[1].color).toBe("#00FF00");
    expect(after.years).toEqual(before.years);
    expect(before.classes[0].label).toBe("Área artificial");
  });

  it("preserva pixelLimit e campos que o contrato não conhece", () => {
    const before = classifiedIndex();
    // `value` aparece em `prodprimariabruta` e não está no contrato: ele
    // sobrevive porque nenhuma linha é reconstruída do zero.
    (before.classes[0] as Record<string, unknown>).value = 1;
    const after = applyLegacyAppearance(before, {
      legend: [
        { id: "area-artificial", label: "Outro rótulo", color: "#FF0000" },
        { id: "area-agricola", label: "Área agrícola", color: "#EBE628" },
      ],
    });

    expect(after.classes[0].pixelLimit).toBe(1);
    expect((after.classes[0] as Record<string, unknown>).value).toBe(1);
  });

  it("descarta o tone da classe cuja cor mudou e mantém o das outras", () => {
    const after = applyLegacyAppearance(classifiedIndex(), {
      legend: [
        { id: "area-artificial", label: "Área artificial", color: "#123456" },
        { id: "area-agricola", label: "Área agrícola", color: "#EBE628" },
      ],
    });

    expect(after.classes[0].tone).toBeUndefined();
    expect(after.classes[1].tone).toEqual({
      bg: "#FFFCE3",
      color: "#7B7600",
      border: "#E7E09A",
    });
  });

  it("sincroniza a paleta do mapa com as cores da legenda", () => {
    const after = applyLegacyAppearance(singleValueIndex(), {
      legend: [
        { id: "0-20", label: "0-20", color: "#FFFFFF" },
        { id: "20-40", label: "20-40", color: "#FED976" },
        { id: "40-60", label: "40-60", color: "#000000" },
      ],
    });

    expect(after.mapVisualization?.palette).toEqual([
      "#FFFFFF",
      "#FED976",
      "#000000",
    ]);
    expect(after.classes[0].color).toBe("#BD0026");
  });

  it("grava a série medida separada das faixas", () => {
    const after = applyLegacyAppearance(singleValueIndex(), {
      legend: readLegacyAppearance(singleValueIndex()).legend,
      series: [
        {
          id: "familias-cadunico-pobreza",
          label: "Famílias inscritas no CadÚnico",
          color: "#BD0026",
        },
      ],
    });

    expect(after.classes[0].label).toBe("Famílias inscritas no CadÚnico");
    expect(after.mapVisualization?.legend?.[0].label).toBe("0-20");
  });

  it("grava limites novos mantendo a quantidade", () => {
    const after = applyLegacyAppearance(singleValueIndex(), {
      legend: readLegacyAppearance(singleValueIndex()).legend,
      thresholds: [30, 60],
    });

    expect(after.mapVisualization?.thresholds).toEqual([30, 60]);
  });

  it("recusa mudar a quantidade de linhas, porque os valores são listas na ordem delas", () => {
    expect(() =>
      applyLegacyAppearance(classifiedIndex(), {
        legend: [
          { id: "area-artificial", label: "Área artificial", color: "#FF0000" },
        ],
      }),
    ).toThrow(/mesma ordem/u);
  });

  it("recusa reordenar as linhas", () => {
    expect(() =>
      applyLegacyAppearance(classifiedIndex(), {
        legend: [
          { id: "area-agricola", label: "Área agrícola", color: "#EBE628" },
          { id: "area-artificial", label: "Área artificial", color: "#FF0000" },
        ],
      }),
    ).toThrow(/mesma ordem/u);
  });

  it("recusa mudar a quantidade de limites", () => {
    expect(() =>
      applyLegacyAppearance(singleValueIndex(), {
        legend: readLegacyAppearance(singleValueIndex()).legend,
        thresholds: [10, 20, 30],
      }),
    ).toThrow(/quantidade de limites não pode mudar/u);
  });

  it("recusa limites num índice que não classifica por limites", () => {
    expect(() =>
      applyLegacyAppearance(classifiedIndex(), {
        legend: readLegacyAppearance(classifiedIndex()).legend,
        thresholds: [50],
      }),
    ).toThrow(/não classifica o mapa por limites/u);
  });

  it("recusa série num índice cujas classes já são a legenda", () => {
    expect(() =>
      applyLegacyAppearance(classifiedIndex(), {
        legend: readLegacyAppearance(classifiedIndex()).legend,
        series: [{ id: "x", label: "X", color: "#000000" }],
      }),
    ).toThrow(/não tem série separada/u);
  });

  it("recusa editar cores quando a paleta gravada tem outro tamanho", () => {
    const imageData = singleValueIndex();
    imageData.mapVisualization!.palette = ["#FFFFCC", "#FED976"];
    const rows = readLegacyAppearance(imageData).legend;

    expect(() =>
      applyLegacyAppearance(imageData, {
        legend: [{ ...rows[0], color: "#000000" }, rows[1], rows[2]],
      }),
    ).toThrow(/paleta do mapa tem 2 cores e a legenda tem 3/u);
  });

  it("deixa editar rótulos mesmo com a paleta de outro tamanho", () => {
    // A paleta só entra em jogo quando alguma cor muda; travar o rótulo por
    // causa dela deixaria o índice sem nenhuma edição possível.
    const imageData = singleValueIndex();
    imageData.mapVisualization!.palette = ["#FFFFCC", "#FED976"];
    const rows = readLegacyAppearance(imageData).legend;

    const after = applyLegacyAppearance(imageData, {
      legend: [{ ...rows[0], label: "Até 20%" }, rows[1], rows[2]],
    });

    expect(after.mapVisualization?.legend?.[0].label).toBe("Até 20%");
    expect(after.mapVisualization?.palette).toEqual(["#FFFFCC", "#FED976"]);
  });
});

describe("assertOnlyAppearanceChanged", () => {
  it("aceita alteração de rótulo, cor, paleta e limites", () => {
    const before = singleValueIndex();
    const after = singleValueIndex();
    after.classes[0].label = "Outro nome";
    after.mapVisualization!.legend![0].color = "#000000";
    after.mapVisualization!.palette = ["#000000", "#FED976", "#FEB24C"];
    after.mapVisualization!.thresholds = [25, 50];

    expect(() => assertOnlyAppearanceChanged(before, after)).not.toThrow();
  });

  it("recusa uma alteração que mexeria nos valores de um período", () => {
    const before = classifiedIndex();
    const after = classifiedIndex();
    after.years["2020"].values.br = [99, 1];

    expect(() => assertOnlyAppearanceChanged(before, after)).toThrow(
      /além de rótulos, cores e limites/u,
    );
  });

  it("recusa uma alteração que mexeria no imageId de um período", () => {
    const before = classifiedIndex();
    const after = classifiedIndex();
    after.years["2020"].imageId = "assets/outro";

    expect(() => assertOnlyAppearanceChanged(before, after)).toThrow(
      /além de rótulos, cores e limites/u,
    );
  });

  it("recusa uma alteração que mexeria no pixelLimit de uma classe", () => {
    const before = classifiedIndex();
    const after = classifiedIndex();
    after.classes[1].pixelLimit = 9;

    expect(() => assertOnlyAppearanceChanged(before, after)).toThrow(
      /além de rótulos, cores e limites/u,
    );
  });
});

describe("summarizeLegacyAppearanceChange", () => {
  it("conta rótulos e cores alterados", () => {
    const before = classifiedIndex();
    const after = applyLegacyAppearance(before, {
      legend: [
        { id: "area-artificial", label: "Outro rótulo", color: "#123456" },
        { id: "area-agricola", label: "Mais um", color: "#EBE628" },
      ],
    });

    expect(summarizeLegacyAppearanceChange(before, after)).toBe(
      "2 rótulos e 1 cor",
    );
  });

  it("nomeia os limites quando eles mudam", () => {
    const before = singleValueIndex();
    const after = applyLegacyAppearance(before, {
      legend: readLegacyAppearance(before).legend,
      thresholds: [25, 50],
    });

    expect(summarizeLegacyAppearanceChange(before, after)).toBe(
      "os limites do mapa",
    );
  });

  it("responde nada quando a edição repete o que está gravado", () => {
    const before = singleValueIndex();
    const after = applyLegacyAppearance(before, {
      legend: readLegacyAppearance(before).legend,
      series: readLegacyAppearance(before).series,
      thresholds: readLegacyAppearance(before).thresholds,
    });

    expect(summarizeLegacyAppearanceChange(before, after)).toBe("nada");
  });
});

describe("applyLegacyAppearance com a paleta em outra ordem", () => {
  it("põe a cor nova na casa da paleta que tinha a cor antiga", () => {
    // Regressão: sincronizar a paleta por posição inverteria as cores do mapa
    // de `cemadenseca` inteiro, porque lá a paleta é indexada pelo valor de
    // pixel e as classes estão listadas na ordem contrária.
    const after = applyLegacyAppearance(reversePaletteIndex(), {
      legend: [
        { id: "normais", label: "Condições normais", color: "#123456" },
        { id: "seca-fraca", label: "Seca fraca", color: "#FCFF50" },
        { id: "seca-extrema", label: "Seca extrema", color: "#CA281B" },
      ],
    });

    expect(after.mapVisualization?.palette).toEqual([
      "CA281B",
      "FCFF50",
      "123456",
    ]);
  });

  it("não reescreve a caixa das letras nem o formato de quem não mudou", () => {
    const before = reversePaletteIndex();
    const appearance = readLegacyAppearance(before);
    const after = applyLegacyAppearance(
      before,
      parseLegacyAppearanceInput({ legend: appearance.legend }),
    );

    // A tela normaliza para `#RRGGBB` em maiúsculas; reescrever `#ffffff` como
    // `#FFFFFF` criaria uma versão nova no Contentful e marcaria o índice como
    // "alterações não publicadas" sem nada ter mudado no mapa.
    expect(after).toEqual(before);
    expect(summarizeLegacyAppearanceChange(before, after)).toBe("nada");
  });

  it("edita rótulos sem tocar na paleta", () => {
    const after = applyLegacyAppearance(reversePaletteIndex(), {
      legend: [
        { id: "normais", label: "Sem seca", color: "#FFFFFF" },
        { id: "seca-fraca", label: "Seca fraca", color: "#FCFF50" },
        { id: "seca-extrema", label: "Seca extrema", color: "#CA281B" },
      ],
    });

    expect(after.classes[0].label).toBe("Sem seca");
    expect(after.classes[0].color).toBe("#ffffff");
    expect(after.mapVisualization?.palette).toEqual([
      "CA281B",
      "FCFF50",
      "FFFFFF",
    ]);
  });

  it("recusa mudar cores quando uma casa da paleta não bate com nenhuma linha", () => {
    const imageData = reversePaletteIndex();
    imageData.mapVisualization!.palette = ["CA281B", "000000", "FFFFFF"];

    expect(() =>
      applyLegacyAppearance(imageData, {
        legend: [
          { id: "normais", label: "Condições normais", color: "#123456" },
          { id: "seca-fraca", label: "Seca fraca", color: "#FCFF50" },
          { id: "seca-extrema", label: "Seca extrema", color: "#CA281B" },
        ],
      }),
    ).toThrow(/não correspondem a exatamente uma linha/u);
  });

  it("aceita editar só o rótulo mesmo com a paleta desalinhada", () => {
    const imageData = reversePaletteIndex();
    imageData.mapVisualization!.palette = ["CA281B", "000000", "FFFFFF"];

    const after = applyLegacyAppearance(imageData, {
      legend: [
        { id: "normais", label: "Sem seca", color: "#FFFFFF" },
        { id: "seca-fraca", label: "Seca fraca", color: "#FCFF50" },
        { id: "seca-extrema", label: "Seca extrema", color: "#CA281B" },
      ],
    });

    expect(after.classes[0].label).toBe("Sem seca");
    expect(after.mapVisualization?.palette).toEqual([
      "CA281B",
      "000000",
      "FFFFFF",
    ]);
  });
});
