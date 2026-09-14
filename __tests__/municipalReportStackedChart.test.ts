import { describe, expect, it } from "vitest";
import {
  buildStackedChartData,
  isStackableAnalysis,
  normalizeStackedShares,
  selectStackedChartSnapshots,
} from "@/utils/municipalReportStackedChart";
import type {
  MunicipalReportAnalysis,
  MunicipalReportPeriodSnapshot,
} from "@/contracts/municipalReport";

function snapshot(
  period: string,
  values: Record<string, number>,
): MunicipalReportPeriodSnapshot {
  const distribution = Object.entries(values).map(([id, percentage]) => ({
    id,
    label: id,
    color: "#123456",
    percentage,
  }));

  return {
    period,
    label: period,
    distribution,
    dominantClass: distribution.reduce((best, item) =>
      item.percentage > best.percentage ? item : best,
    ),
  };
}

const analysisBase = {
  id: "anaseca",
  alias: "seca",
  title: "Monitor de Secas",
  unit: "%",
  status: "available" as const,
  requestedPeriod: "2026-05",
  effectivePeriod: "2026-05",
  snapshot: null,
};

const analysis = {
  ...analysisBase,
  valueType: "percentage" as const,
  classes: [
    { id: "sem-seca", label: "Sem seca", color: "#CCCCCC" },
    { id: "seca-fraca", label: "Seca fraca", color: "#FFEB00" },
  ],
  timeSeries: [
    snapshot("2026-04", { "sem-seca": 72, "seca-fraca": 28 }),
    snapshot("2026-05", { "sem-seca": 28.3, "seca-fraca": 71.7 }),
  ],
} as MunicipalReportAnalysis;

describe("normalizeStackedShares", () => {
  it("faz as fatias somarem exatamente 100", () => {
    const shares = normalizeStackedShares({ a: 33.3, b: 33.3, c: 33.3 });
    const total = Object.values(shares).reduce((sum, value) => sum + value, 0);

    expect(total).toBeCloseTo(100, 9);
  });

  it("preserva a proporção entre as classes", () => {
    const shares = normalizeStackedShares({ a: 71.7, b: 28.3 });

    expect(shares.a).toBeCloseTo(71.7, 6);
    expect(shares.b).toBeCloseTo(28.3, 6);
  });

  it("devolve zeros quando a coluna não tem dado, em vez de dividir por zero", () => {
    expect(normalizeStackedShares({ a: 0, b: 0 })).toEqual({ a: 0, b: 0 });
  });
});

describe("selectStackedChartSnapshots", () => {
  const series = Array.from({ length: 29 }, (_, index) =>
    snapshot(`2024-${String(index + 1).padStart(2, "0")}`, { a: 100 }),
  );

  it("devolve a série inteira quando ela cabe", () => {
    expect(selectStackedChartSnapshots(series.slice(0, 8), 12, null)).toHaveLength(
      8,
    );
  });

  it("amostra até o teto", () => {
    expect(selectStackedChartSnapshots(series, 12, null)).toHaveLength(12);
  });

  it("preserva as duas pontas da série", () => {
    const picked = selectStackedChartSnapshots(series, 12, null);

    expect(picked[0].period).toBe(series[0].period);
    expect(picked.at(-1)!.period).toBe(series.at(-1)!.period);
  });

  it("mantém o período de referência mesmo quando a amostragem o pularia", () => {
    const reference = series[13].period;
    const picked = selectStackedChartSnapshots(series, 12, reference);

    expect(picked.map((item) => item.period)).toContain(reference);
    expect(picked).toHaveLength(12);
  });

  it("não devolve período repetido", () => {
    const picked = selectStackedChartSnapshots(series, 12, series[13].period);

    expect(new Set(picked.map((item) => item.period)).size).toBe(picked.length);
  });

  it("devolve em ordem cronológica mesmo recebendo fora de ordem", () => {
    const picked = selectStackedChartSnapshots(
      [snapshot("2026-05", { a: 1 }), snapshot("2026-04", { a: 1 })],
      12,
      null,
    );

    expect(picked.map((item) => item.period)).toEqual(["2026-04", "2026-05"]);
  });

  it("devolve vazio quando o teto é zero", () => {
    expect(selectStackedChartSnapshots(series, 0, null)).toEqual([]);
  });
});

describe("isStackableAnalysis", () => {
  it("aceita índice percentual com mais de uma classe", () => {
    expect(isStackableAnalysis(analysis)).toBe(true);
  });

  it("recusa índice de valor absoluto", () => {
    expect(
      isStackableAnalysis({
        ...analysis,
        valueType: "absolute",
      } as MunicipalReportAnalysis),
    ).toBe(false);
  });

  it("recusa índice de classe única", () => {
    expect(
      isStackableAnalysis({
        ...analysis,
        classes: [{ id: "a", label: "A", color: "#1" }],
      } as MunicipalReportAnalysis),
    ).toBe(false);
  });
});

describe("buildStackedChartData", () => {
  it("monta uma linha por período, na ordem cronológica", () => {
    const data = buildStackedChartData(analysis, "2026-05", 12);

    expect(data.rows.map((row) => row.period)).toEqual(["2026-04", "2026-05"]);
  });

  it("marca o período de referência", () => {
    const data = buildStackedChartData(analysis, "2026-05", 12);

    expect(data.rows.at(-1)!.highlighted).toBe(true);
    expect(data.rows[0].highlighted).toBe(false);
  });

  it("guarda o valor bruto ao lado da fatia normalizada", () => {
    const data = buildStackedChartData(analysis, "2026-05", 12);

    expect(data.rows.at(-1)!.raw["seca-fraca"]).toBe(71.7);
  });

  it("declara uma série por classe do índice, e não por classe presente na série", () => {
    const data = buildStackedChartData(
      {
        ...analysis,
        classes: [
          ...analysis.classes,
          { id: "seca-extrema", label: "Seca extrema", color: "#7B0000" },
        ],
      } as MunicipalReportAnalysis,
      "2026-05",
      12,
    );

    expect(data.series.map((item) => item.id)).toEqual([
      "sem-seca",
      "seca-fraca",
      "seca-extrema",
    ]);
    expect(data.rows[0].raw["seca-extrema"]).toBe(0);
  });

  it("expõe as pontas da série desenhada", () => {
    const data = buildStackedChartData(analysis, "2026-05", 12);

    expect(data.firstPeriod).toBe("2026-04");
    expect(data.lastPeriod).toBe("2026-05");
  });

  it("devolve pontas nulas quando não há série", () => {
    const data = buildStackedChartData(
      { ...analysis, timeSeries: [] } as MunicipalReportAnalysis,
      "2026-05",
      12,
    );

    expect(data.rows).toEqual([]);
    expect(data.firstPeriod).toBeNull();
    expect(data.lastPeriod).toBeNull();
  });
});
