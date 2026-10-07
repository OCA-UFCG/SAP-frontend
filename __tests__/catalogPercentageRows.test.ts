import { describe, expect, it } from "vitest";
import {
  countInvalidPercentageRows,
  parsePercentageColumns,
} from "@/utils/catalogPercentageRows";

const TOLERANCE = 0.2;

describe("countInvalidPercentageRows", () => {
  it("aceita linhas que somam 100", () => {
    const columns = [
      [60, 25],
      [40, 75],
    ];
    expect(countInvalidPercentageRows(columns, TOLERANCE)).toBe(0);
  });

  it("rejeita a linha cujos percentuais somam 90", () => {
    const columns = [
      [60, 45],
      [40, 45],
    ];
    expect(countInvalidPercentageRows(columns, TOLERANCE)).toBe(1);
  });

  it("aceita a linha inteiramente zerada, que representa ausência de dado", () => {
    const columns = [
      [0, 60],
      [0, 40],
    ];
    expect(countInvalidPercentageRows(columns, TOLERANCE)).toBe(0);
  });

  it("rejeita percentual negativo e acima de 100 mesmo quando a soma fecha", () => {
    const columns = [
      [-10, 110],
      [110, -10],
    ];
    expect(countInvalidPercentageRows(columns, TOLERANCE)).toBe(2);
  });

  it("aceita a soma dentro da tolerância e rejeita fora dela", () => {
    const columns = [
      [99.9, 99.5],
      [0.2, 0.2],
    ];
    expect(countInvalidPercentageRows(columns, TOLERANCE)).toBe(1);
  });

  it("rejeita valores ausentes ou não numéricos", () => {
    const columns = [[100], [Number.NaN]];
    expect(countInvalidPercentageRows(columns, TOLERANCE)).toBe(1);
  });
});

describe("parsePercentageColumns", () => {
  const properties = ["perc_classe_0", "perc_classe_1"];

  it("devolve as colunas quando todas trazem uma entrada por linha", () => {
    const columns = [
      [60, 25],
      [40, 75],
    ];
    expect(parsePercentageColumns(columns, properties, 2, "asset")).toEqual(
      columns,
    );
  });

  it("falha quando uma coluna vem mais curta que o total de linhas", () => {
    // reduceColumns descarta linhas nulas: se descartasse em uma coluna e não em
    // outra, os índices desalinhariam e a checagem compararia linhas diferentes.
    expect(() =>
      parsePercentageColumns([[60, 25], [40]], properties, 2, "asset"),
    ).toThrow(/perc_classe_1 de asset retornou 1 valor\(es\); esperado 2/u);
  });

  it("falha quando vêm menos colunas que propriedades de percentual", () => {
    expect(() =>
      parsePercentageColumns([[60, 25]], properties, 2, "asset"),
    ).toThrow(/retornou 1 coluna\(s\) de percentual; esperado 2/u);
  });

  it("falha quando a resposta não é uma lista", () => {
    expect(() => parsePercentageColumns(null, properties, 2, "asset")).toThrow(
      /retornou object coluna\(s\) de percentual; esperado 2/u,
    );
  });
});
