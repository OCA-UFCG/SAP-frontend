import { describe, expect, it } from "vitest";
import {
  formatAbsoluteNumber,
  formatDecimalNumber,
  formatPercentageNumber,
} from "@/utils/formatTerritorialNumber";

describe("formatAbsoluteNumber", () => {
  it("abrevia o PIB do Brasil em vez de mostrar o número por extenso", () => {
    expect(formatAbsoluteNumber(10_943_345_438_880, "pt-BR")).toBe(
      "10,94 trilhões",
    );
  });

  it("usa bilhões e milhões a partir de um bilhão e de um milhão", () => {
    expect(formatAbsoluteNumber(3_200_000_000, "pt-BR")).toBe("3,20 bilhões");
    expect(formatAbsoluteNumber(2_500_000, "pt-BR")).toBe("2,50 milhões");
    expect(formatAbsoluteNumber(-1_000_000, "pt-BR")).toBe("-1,00 milhão");
  });

  it("usa o singular abaixo de dois: 1,50 milhão", () => {
    expect(formatAbsoluteNumber(1_500_000, "pt-BR")).toBe("1,50 milhão");
    expect(formatAbsoluteNumber(1_000_000_000_000, "pt-BR")).toBe(
      "1,00 trilhão",
    );
  });

  it("escreve a escala por extenso em inglês e espanhol", () => {
    expect(formatAbsoluteNumber(3_200_000_000, "en-US")).toBe("3.20 billion");
    expect(formatAbsoluteNumber(3_200_000_000, "es")).toBe("3,20 mil millones");
    expect(formatAbsoluteNumber(2_000_000_000_000, "es")).toBe("2,00 billones");
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
