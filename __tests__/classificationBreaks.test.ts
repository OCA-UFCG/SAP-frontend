import { describe, expect, it } from "vitest";
import {
  CLASSIFICATION_METHODS,
  computeClassBreaks,
} from "@/utils/classificationBreaks";
import {
  buildClassificationSample,
  CLASSIFICATION_SAMPLE_LIMIT,
} from "@/utils/classificationSample";
import { resizeValueRanges } from "@/utils/municipalValueIndicator";

function sampleOf(values: number[]) {
  const sample = buildClassificationSample(values);
  if (!sample) throw new Error("Amostra vazia no teste.");
  return sample;
}

const zeroToHundred = () =>
  sampleOf(Array.from({ length: 101 }, (_value, index) => index));

describe("buildClassificationSample", () => {
  it("ignora nulos e valores não finitos", () => {
    const sample = sampleOf([3, Number.NaN, 1, 2]);
    expect(sample.count).toBe(3);
    expect(sample.min).toBe(1);
    expect(sample.max).toBe(3);
    expect(sample.mean).toBe(2);
  });

  it("devolve null quando nenhum valor é número", () => {
    expect(buildClassificationSample([null, undefined])).toBeNull();
  });

  it("reduz a amostra mantendo média e desvio do conjunto completo", () => {
    const values = Array.from({ length: 5570 }, (_value, index) => index);
    const sample = sampleOf(values);
    expect(sample.values).toHaveLength(CLASSIFICATION_SAMPLE_LIMIT);
    expect(sample.count).toBe(5570);
    expect(sample.min).toBe(0);
    expect(sample.max).toBe(5569);
    expect(sample.mean).toBeCloseTo(2784.5, 5);
  });
});

describe("computeClassBreaks", () => {
  it("corta em faixas de mesma largura", () => {
    expect(
      computeClassBreaks(zeroToHundred(), {
        method: "equalInterval",
        classCount: 4,
      }),
    ).toEqual({ thresholds: [25, 50, 75], classCount: 4 });
  });

  it("deixa a mesma quantidade de valores em cada faixa", () => {
    const { thresholds } = computeClassBreaks(zeroToHundred(), {
      method: "quantile",
      classCount: 4,
    });
    expect(thresholds).toEqual([25, 50, 75]);
  });

  it("encontra o degrau que existe nos dados", () => {
    expect(
      computeClassBreaks(sampleOf([1, 2, 3, 10, 11, 12]), {
        method: "naturalBreaks",
        classCount: 2,
      }).thresholds,
    ).toEqual([10]);
  });

  it("separa três grupos com quebras naturais", () => {
    expect(
      computeClassBreaks(sampleOf([1, 2, 20, 21, 50, 51]), {
        method: "naturalBreaks",
        classCount: 3,
      }).thresholds,
    ).toEqual([20, 50]);
  });

  it("faz as faixas crescerem no intervalo geométrico", () => {
    const { thresholds } = computeClassBreaks(sampleOf([1, 10, 100, 1000]), {
      method: "geometricalInterval",
      classCount: 3,
    });
    const widths = [
      thresholds[0] - 1,
      thresholds[1] - thresholds[0],
      1000 - thresholds[1],
    ];
    expect(widths[1]).toBeGreaterThan(widths[0]);
    expect(widths[2]).toBeGreaterThan(widths[1]);
  });

  it("aceita valores negativos no intervalo geométrico", () => {
    const { thresholds } = computeClassBreaks(sampleOf([-30, -10, 0, 90]), {
      method: "geometricalInterval",
      classCount: 3,
    });
    expect(thresholds).toHaveLength(2);
    expect(thresholds[0]).toBeGreaterThan(-30);
    expect(thresholds[1]).toBeLessThan(90);
  });

  it("deriva a quantidade de faixas do tamanho do intervalo", () => {
    expect(
      computeClassBreaks(zeroToHundred(), {
        method: "definedInterval",
        classCount: 4,
        intervalSize: 25,
      }),
    ).toEqual({ thresholds: [25, 50, 75], classCount: 4 });
  });

  it("recusa um intervalo que não chega a três faixas", () => {
    expect(() =>
      computeClassBreaks(zeroToHundred(), {
        method: "definedInterval",
        classCount: 4,
        intervalSize: 80,
      }),
    ).toThrow(/três faixas/u);
  });

  it("usa a média como limite no desvio padrão", () => {
    const sample = sampleOf([0, 10, 20, 30, 40]);
    const { thresholds } = computeClassBreaks(sample, {
      method: "standardDeviation",
      classCount: 4,
      deviationInterval: 1,
    });
    expect(thresholds).toContain(20);
    expect(thresholds).toEqual([...thresholds].sort((a, b) => a - b));
  });

  it("recusa o desvio padrão quando todos os valores são iguais", () => {
    expect(() =>
      computeClassBreaks(
        { ...sampleOf([1, 2]), standardDeviation: 0 },
        { method: "standardDeviation", classCount: 3, deviationInterval: 1 },
      ),
    ).toThrow(/desvio padrão/u);
  });

  it("recusa limites repetidos quando há valores demais empatados", () => {
    const values = [...Array.from({ length: 90 }, () => 0), 1, 2, 3, 4, 5];
    expect(() =>
      computeClassBreaks(sampleOf(values), {
        method: "quantile",
        classCount: 5,
      }),
    ).toThrow(/repetiu limites/u);
  });

  it("recusa uma amostra sem variação", () => {
    expect(() =>
      computeClassBreaks(sampleOf([7, 7, 7]), {
        method: "equalInterval",
        classCount: 3,
      }),
    ).toThrow(/não variam/u);
  });

  it("recusa uma quantidade de faixas fora do intervalo aceito", () => {
    expect(() =>
      computeClassBreaks(zeroToHundred(), {
        method: "equalInterval",
        classCount: 1,
      }),
    ).toThrow(/entre 2 e 24/u);
  });

  it("não calcula nada no método manual", () => {
    expect(() =>
      computeClassBreaks(zeroToHundred(), { method: "manual", classCount: 4 }),
    ).toThrow(/sem cálculo automático/u);
  });

  it("mantém casas decimais suficientes para os limites não colidirem", () => {
    const values = Array.from(
      { length: 200 },
      (_value, index) => 1 + index * 0.0005,
    );
    const { thresholds } = computeClassBreaks(sampleOf(values), {
      method: "equalInterval",
      classCount: 4,
    });
    expect(new Set(thresholds).size).toBe(3);
  });

  it("cobre os sete métodos do ArcGIS", () => {
    expect(CLASSIFICATION_METHODS).toHaveLength(7);
  });
});

describe("resizeValueRanges", () => {
  const ranges = [
    { classIndex: 0, id: "faixa-1", label: "Baixo", color: "#111111" },
    { classIndex: 1, id: "faixa-2", label: "Alto", color: "#222222" },
  ];

  it("preserva rótulo e cor das faixas que já existiam", () => {
    const resized = resizeValueRanges(ranges, 4);
    expect(resized).toHaveLength(4);
    expect(resized[0]).toMatchObject({ label: "Baixo", color: "#111111" });
    expect(resized[3]).toMatchObject({ label: "", color: "#CCCCCC" });
  });

  it("não repete ids, que o cadastro recusa duplicados", () => {
    const resized = resizeValueRanges(ranges, 6);
    expect(new Set(resized.map((range) => range.id)).size).toBe(6);
  });

  it("corta do fim e renumera ao reduzir a quantidade de faixas", () => {
    const resized = resizeValueRanges(ranges, 1);
    expect(resized).toEqual([
      {
        classIndex: 0,
        id: "faixa-1",
        label: "Baixo",
        color: "#111111",
        pixelValue: 0,
      },
    ]);
  });
});
