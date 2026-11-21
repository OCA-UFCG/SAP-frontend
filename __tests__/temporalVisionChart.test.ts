import { describe, expect, it } from "vitest";
import {
  dominantRuns,
  dragWindow,
  fitLabel,
  initialWindowSize,
  niceAxisMax,
  overviewFill,
  pickAxisTicks,
  shiftWindow,
  shortenLabel,
  spreadLabelPositions,
  strokeOnWhite,
} from "@/components/analysis/temporalVisionChart";

describe("initialWindowSize", () => {
  it("não mostra mini-mapa quando a série já cabe inteira", () => {
    expect(initialWindowSize(2, false)).toBeNull();
    expect(initialWindowSize(8, false)).toBeNull();
    expect(initialWindowSize(36, true)).toBeNull();
  });

  it("abre nos últimos 8 anos ou no último ano de decêndios", () => {
    expect(initialWindowSize(22, false)).toBe(8);
    expect(initialWindowSize(927, true)).toBe(36);
  });
});

describe("dragWindow", () => {
  it("anda com a janela inteira sem mudar o tamanho", () => {
    expect(dragWindow([891, 926], "move", 500, 18, 927, 12)).toEqual([
      482, 517,
    ]);
  });

  it("não deixa a janela sair da série", () => {
    expect(dragWindow([891, 926], "move", 5, 18, 927, 12)).toEqual([0, 35]);
    expect(dragWindow([0, 35], "move", 2000, 0, 927, 12)).toEqual([891, 926]);
  });

  it("puxar a borda da esquerda mostra mais tempo para trás", () => {
    expect(dragWindow([891, 926], "start", 800, 0, 927, 12)).toEqual([
      800, 926,
    ]);
  });

  it("puxar a borda da direita para dentro encolhe até o mínimo", () => {
    expect(dragWindow([891, 926], "end", 892, 0, 927, 12)).toEqual([891, 902]);
  });
});

describe("shiftWindow", () => {
  it("para no começo e no fim da série", () => {
    expect(shiftWindow([10, 19], -50, 100)).toEqual([0, 9]);
    expect(shiftWindow([10, 19], 500, 100)).toEqual([90, 99]);
  });
});

describe("dominantRuns", () => {
  it("junta períodos seguidos com a mesma classe maior", () => {
    expect(
      dominantRuns(
        [
          [90, 90, 10],
          [10, 10, 90],
        ],
        3,
      ),
    ).toEqual([
      { start: 0, end: 1, classIndex: 0 },
      { start: 2, end: 2, classIndex: 1 },
    ]);
  });

  it("deixa em branco o período sem dado", () => {
    expect(dominantRuns([[50, null, 50]], 3)).toEqual([
      { start: 0, end: 0, classIndex: 0 },
      { start: 2, end: 2, classIndex: 0 },
    ]);
  });
});

describe("overviewFill", () => {
  it("troca o branco do Sem seca por um cinza claro", () => {
    expect(overviewFill("#FFFFFF")).toBe("#EBECE6");
    expect(overviewFill("#FF0000")).toBe("#FF0000");
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
