import { describe, expect, it } from "vitest";
import {
  analysisValueSuffix,
  hasPercentageScale,
  measurementUnitSuffix,
} from "@/utils/analysisValue";

describe("analysisValue", () => {
  it("cola o % no número e separa as demais unidades", () => {
    expect(measurementUnitSuffix("%")).toBe("%");
    expect(measurementUnitSuffix("registros")).toBe(" registros");
  });

  it("assume % quando o índice não declara unidade", () => {
    expect(measurementUnitSuffix(undefined)).toBe("%");
    expect(measurementUnitSuffix("  ")).toBe("%");
  });

  // Regressão: o ranking de estados escrevia `%` fixo em todo índice que não
  // fosse contagem, então um indicador em mm saía como "742,0%".
  it("usa a unidade do indicador num valor relativo", () => {
    expect(analysisValueSuffix("percentage", "mm")).toBe(" mm");
    expect(analysisValueSuffix("percentage", "%")).toBe("%");
  });

  it("não inventa unidade numa contagem sem unidade declarada", () => {
    expect(analysisValueSuffix("absolute", undefined)).toBe("");
    expect(analysisValueSuffix("absolute", "registros")).toBe(" registros");
  });

  // A barra proporcional e o eixo travado em 100 só dizem a verdade de 0 a 100.
  it("reconhece a escala de 0 a 100 só quando a unidade é %", () => {
    expect(hasPercentageScale("percentage", "%")).toBe(true);
    expect(hasPercentageScale("percentage", undefined)).toBe(true);
    expect(hasPercentageScale("percentage", "mm")).toBe(false);
    expect(hasPercentageScale("absolute", "%")).toBe(false);
  });
});
