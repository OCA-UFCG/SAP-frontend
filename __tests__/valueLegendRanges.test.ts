import { describe, expect, it } from "vitest";

import type { MunicipalValueIndicator } from "@/types/indexCatalog";
import { buildSequentialColorRamp } from "@/utils/sequentialColorRamp";
import { buildValueLegendRanges } from "@/utils/valueLegendRanges";

const INDICATOR: MunicipalValueIndicator = {
  label: "Registros de secas",
  measurementUnit: "registros",
  color: "#1B5E20",
  valueType: "absolute",
};

describe("buildValueLegendRanges", () => {
  it("descreve cada faixa e a colore num tom da cor do indicador", () => {
    const ranges = buildValueLegendRanges([6, 12], INDICATOR);

    expect(ranges).toHaveLength(3);
    expect(ranges[0].label.startsWith("menos de ")).toBe(true);
    expect(ranges.at(-1)?.label.endsWith(" ou mais")).toBe(true);
    expect(ranges.map((range) => range.color)).toEqual(
      buildSequentialColorRamp(INDICATOR.color, 3),
    );
    expect(ranges.map((range) => range.classIndex)).toEqual([0, 1, 2]);
    expect(ranges.map((range) => range.id)).toEqual([
      "faixa-1",
      "faixa-2",
      "faixa-3",
    ]);
  });

  it("nomeia a faixa do meio pelos dois limites que a cercam", () => {
    const ranges = buildValueLegendRanges([6, 12], INDICATOR);

    expect(ranges[1].label).toBe("6 a 12");
  });

  it("escreve o rótulo do percentual com o sinal de porcento", () => {
    const ranges = buildValueLegendRanges([10, 20], {
      ...INDICATOR,
      valueType: "percentage",
      measurementUnit: "%",
    });

    expect(ranges[0].label).toMatch(/%$/u);
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
