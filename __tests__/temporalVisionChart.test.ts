import { describe, expect, it } from "vitest";
import {
  fitLabel,
  niceAxisMax,
  pickAxisTicks,
  shortenLabel,
  spreadLabelPositions,
  strokeOnWhite,
  temporalRangeOptions,
  visibleRange,
} from "@/components/analysis/temporalVisionChart";

describe("temporalRangeOptions", () => {
  it("não mostra botão quando a série anual já cabe inteira", () => {
    expect(temporalRangeOptions(2, false)).toBeNull();
    expect(temporalRangeOptions(8, false)).toBeNull();
  });

  it("oferece os últimos 8 ou tudo numa série anual longa", () => {
    expect(temporalRangeOptions(22, false)).toEqual([
      { key: "recent", size: 8 },
      { key: "all", size: 22 },
    ]);
  });

  it("oferece 12 meses, 5 anos e tudo nos 927 decêndios do CDI", () => {
    expect(temporalRangeOptions(927, true)).toEqual([
      { key: "recent", size: 36 },
      { key: "fiveYears", size: 180 },
      { key: "all", size: 927 },
    ]);
  });

  it("não oferece 5 anos quando a série decendial é mais curta que isso", () => {
    expect(temporalRangeOptions(100, true)?.map((option) => option.key)).toEqual(
      ["recent", "all"],
    );
  });
});

describe("visibleRange", () => {
  it("mostra sempre os períodos mais recentes", () => {
    const options = temporalRangeOptions(927, true);
    expect(visibleRange(927, options, "recent")).toEqual([891, 926]);
    expect(visibleRange(927, options, "all")).toEqual([0, 926]);
  });

  it("volta à primeira opção quando a escolhida não existe nesta série", () => {
    const options = temporalRangeOptions(22, false);
    expect(visibleRange(22, options, "fiveYears")).toEqual([14, 21]);
  });

  it("mostra a série inteira quando não há botões", () => {
    expect(visibleRange(2, null, "recent")).toEqual([0, 1]);
  });
});

describe("niceAxisMax", () => {
  it("arredonda o topo do eixo para um número redondo", () => {
    expect(niceAxisMax(0.65)).toBe(1);
    expect(niceAxisMax(2780)).toBe(5000);
    expect(niceAxisMax(180)).toBe(200);
    expect(niceAxisMax(240)).toBe(250);
    expect(niceAxisMax(0)).toBe(1);
  });
});

describe("spreadLabelPositions", () => {
  const bounds = { top: 0, bottom: 200, gap: 14 };

  it("mantém na altura da linha os rótulos que não se encostam", () => {
    expect(spreadLabelPositions([40, 100, 180], bounds)).toEqual([
      40, 100, 180,
    ]);
  });

  it("afasta os rótulos que se encostam e devolve na ordem de entrada", () => {
    expect(spreadLabelPositions([100, 104, 40], bounds)).toEqual([
      100, 114, 40,
    ]);
  });

  it("empurra para cima os rótulos que passariam do fundo", () => {
    // Três classes no zero, como Nível 1, Nível 5 e Nível 2 da Degradação.
    expect(spreadLabelPositions([200, 200, 200], bounds)).toEqual([
      172, 186, 200,
    ]);
  });
});

describe("strokeOnWhite", () => {
  it("escurece a classe branca para a linha não sumir no fundo", () => {
    const stroke = strokeOnWhite("#FFFFFF");
    expect(stroke).not.toBe("#FFFFFF");
    expect(stroke).toBe("#b8b8b4");
  });

  it("mantém as cores que já aparecem no branco", () => {
    expect(strokeOnWhite("#6510A2")).toBe("#6510A2");
    expect(strokeOnWhite("#FF0000")).toBe("#FF0000");
  });

  it("devolve como veio uma cor que não é hexadecimal", () => {
    expect(strokeOnWhite("rgb(1, 2, 3)")).toBe("rgb(1, 2, 3)");
  });
});

describe("pickAxisTicks", () => {
  const formatMonth = (year: number, month: number) =>
    `${month}/${String(year).slice(2)}`;

  it("marca todos os anos quando cabem", () => {
    const periods = ["2000", "2010", "2014", "2016", "2018", "2020"];
    expect(
      pickAxisTicks(periods, 0, 5, false, 204, formatMonth).map(
        (tick) => tick.label,
      ),
    ).toEqual(periods);
  });

  it("pula períodos quando não cabem, sem perder o mais recente", () => {
    const periods = Array.from({ length: 22 }, (_, i) => `2024-${i}`);
    const ticks = pickAxisTicks(periods, 0, 21, false, 210, formatMonth);
    expect(ticks.at(-1)?.index).toBe(21);
    expect(ticks.length).toBeLessThanOrEqual(4);
  });

  it("marca os trimestres num ano de decêndios", () => {
    const periods: string[] = [];
    for (const month of [10, 11, 12]) {
      for (const day of ["01", "11", "21"]) {
        periods.push(`2025-${month}-${day}`);
      }
    }
    for (let month = 1; month <= 9; month += 1) {
      for (const day of ["01", "11", "21"]) {
        periods.push(`2026-${String(month).padStart(2, "0")}-${day}`);
      }
    }
    expect(
      pickAxisTicks(periods, 0, periods.length - 1, true, 210, formatMonth).map(
        (tick) => tick.label,
      ),
    ).toEqual(["10/25", "1/26", "4/26", "7/26"]);
  });
});

describe("shortenLabel", () => {
  it("corta nomes longos com reticências", () => {
    expect(shortenLabel("Mosaico de Ocupações em Área Campestre", 13)).toBe(
      "Mosaico de O…",
    );
    expect(shortenLabel("Nível 4", 13)).toBe("Nível 4");
  });
});

describe("fitLabel", () => {
  const measure = (text: string) => text.length * 6;

  it("mantém o nome inteiro quando ele cabe", () => {
    expect(fitLabel("Nível 4", 60, measure)).toBe("Nível 4");
  });

  it("corta só o necessário para caber", () => {
    expect(fitLabel("Mosaico de Ocupações", 60, measure)).toBe("Mosaico d…");
  });
});
