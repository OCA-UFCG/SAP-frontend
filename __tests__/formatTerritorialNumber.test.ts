import { describe, expect, it } from "vitest";
import {
  formatAbsoluteNumber,
  formatDecimalNumber,
  formatPercentageNumber,
} from "@/utils/formatTerritorialNumber";

describe("formatAbsoluteNumber", () => {
  it("abrevia o PIB do Brasil em vez de mostrar o número por extenso", () => {
    expect(formatAbsoluteNumber(10_943_345_438_880, "pt-BR")).toBe("10,94 Tri");
  });

  it("usa Bi e Mi a partir de um bilhão e de um milhão", () => {
    expect(formatAbsoluteNumber(3_200_000_000, "pt-BR")).toBe("3,20 Bi");
    expect(formatAbsoluteNumber(2_500_000, "pt-BR")).toBe("2,50 Mi");
    expect(formatAbsoluteNumber(-1_000_000, "pt-BR")).toBe("-1,00 Mi");
  });

  it("usa as siglas em inglês no locale en", () => {
    expect(formatAbsoluteNumber(3_200_000_000, "en-US")).toBe("3.20 B");
  });

  it("mantém valores abaixo de um milhão por extenso, com duas casas", () => {
    expect(formatAbsoluteNumber(999_999, "pt-BR")).toBe("999.999");
    expect(formatAbsoluteNumber(1234.5, "pt-BR")).toBe("1.234,50");
  });
});

describe("formatDecimalNumber", () => {
  it("não mostra ',0': decimais sempre com duas casas, inteiros sem casas", () => {
    expect(formatDecimalNumber(12.3, "pt-BR")).toBe("12,30");
    expect(formatDecimalNumber(12, "pt-BR")).toBe("12");
  });
});

describe("formatPercentageNumber", () => {
  it("mostra percentuais com duas casas", () => {
    expect(formatPercentageNumber(52, "pt-BR")).toBe("52,00");
  });
});
