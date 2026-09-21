import { describe, expect, it } from "vitest";

import type { MunicipalValueIndicator } from "@/types/indexCatalog";
import { buildSequentialColorRamp } from "@/utils/sequentialColorRamp";
import { detectValueLegend } from "@/utils/spreadsheetLegendDetection";

const INDICATOR: MunicipalValueIndicator = {
  label: "Registros de secas",
  measurementUnit: "registros",
  color: "#1B5E20",
  valueType: "absolute",
};

/** Uma distribuição torta como a dos dados municipais brasileiros. */
function skewedMunicipalValues() {
  return [
    ...Array.from({ length: 200 }, (_entry, position) => position + 1),
    ...Array.from({ length: 20 }, (_entry, position) => 900 + position * 37),
    99_000,
  ];
}

describe("detectValueLegend", () => {
  it("separa as faixas por quantidade de municípios, e não pelo intervalo", () => {
    const legend = detectValueLegend(skewedMunicipalValues(), INDICATOR, 5);

    expect(legend.method).toBe("quantile");
    expect(legend.rangeCount).toBe(5);
    expect(legend.thresholds).toHaveLength(4);
    // Um corte por intervalos iguais começaria perto de 19.800; os quantis
    // ficam onde os municípios estão.
    expect(legend.thresholds.at(-1)).toBeLessThan(1_000);
  });

  it("devolve limites crescentes e arredondados para leitura", () => {
    const legend = detectValueLegend(skewedMunicipalValues(), INDICATOR, 5);

    const increasing = legend.thresholds.every(
      (value, position) =>
        position === 0 || value > legend.thresholds[position - 1],
    );
    expect(increasing).toBe(true);
    expect(legend.thresholds.map((value) => Number.isInteger(value))).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it("descreve cada faixa e a colore num tom da cor do indicador", () => {
    const legend = detectValueLegend(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      INDICATOR,
      3,
    );

    expect(legend.ranges).toHaveLength(3);
    expect(legend.ranges[0].label.startsWith("menos de ")).toBe(true);
    expect(legend.ranges.at(-1)?.label.endsWith(" ou mais")).toBe(true);
    expect(legend.ranges.map((range) => range.color)).toEqual(
      buildSequentialColorRamp(INDICATOR.color, 3),
    );
    expect(legend.ranges.map((range) => range.classIndex)).toEqual([0, 1, 2]);
    expect(legend.ranges.map((range) => range.id)).toEqual([
      "faixa-1",
      "faixa-2",
      "faixa-3",
    ]);
  });

  it("escreve o rótulo do percentual com o sinal de porcento", () => {
    const legend = detectValueLegend(
      [10, 20, 30, 40, 50, 60],
      { ...INDICATOR, valueType: "percentage", measurementUnit: "%" },
      3,
    );

    expect(legend.ranges[0].label).toMatch(/%$/u);
  });

  it("corta em partes iguais quando os valores se repetem demais", () => {
    const repeated = [...Array.from({ length: 100 }, () => 0), 10, 50, 100];

    const legend = detectValueLegend(repeated, INDICATOR, 5);

    expect(legend.method).toBe("interval");
    expect(legend.thresholds.length).toBeGreaterThan(0);
  });

  it("ignora os municípios sem valor na contagem da amostra", () => {
    const legend = detectValueLegend([1, 2, 3, Number.NaN], INDICATOR, 2);

    expect(legend.sampleCount).toBe(3);
  });

  it("recusa uma planilha com um valor só, em vez de inventar faixas", () => {
    expect(() => detectValueLegend([7, 7, 7], INDICATOR)).toThrow(
      /valor\(es\) distinto\(s\)/u,
    );
  });
});

describe("buildSequentialColorRamp", () => {
  it("vai do tom claro até a cor pedida", () => {
    const ramp = buildSequentialColorRamp("#1B5E20", 4);

    expect(ramp).toHaveLength(4);
    expect(ramp.at(-1)).toBe("#1B5E20");
    expect(ramp.every((color) => /^#[0-9A-F]{6}$/u.test(color))).toBe(true);
  });

  it("aceita cor em três dígitos e cai num verde quando o texto não é cor", () => {
    expect(buildSequentialColorRamp("#abc", 1)).toEqual(["#AABBCC"]);
    expect(buildSequentialColorRamp("verde", 1)).toEqual(["#1B5E20"]);
  });
});
