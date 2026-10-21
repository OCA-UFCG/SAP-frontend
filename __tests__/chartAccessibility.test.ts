import { describe, expect, it } from "vitest";
import {
  describeChartSummary,
  summarizeChartRows,
  type ChartTableRow,
  type ChartTableSeries,
} from "@/utils/chartAccessibility";

const series: ChartTableSeries[] = [
  { id: "sem", label: "Sem seca" },
  { id: "fraca", label: "Seca fraca" },
];

const rows: ChartTableRow[] = [
  { period: "2022", label: "2022", values: { sem: 70, fraca: 30 } },
  { period: "2023", label: "2023", values: { sem: 10, fraca: 90 } },
  { period: "2024", label: "2024", values: { sem: 55, fraca: null } },
];

/** Tradutor falso: devolve a chave e os valores, para a frase ser conferível. */
class EchoTranslator {
  translate = (key: string, values: Record<string, string | number>) =>
    `${key}(${Object.values(values).join("|")})`;
}

describe("summarizeChartRows", () => {
  it("diz o intervalo e quantas classes a série tem", () => {
    const summary = summarizeChartRows(rows, series);

    expect(summary?.firstPeriod).toBe("2022");
    expect(summary?.lastPeriod).toBe("2024");
    expect(summary?.seriesCount).toBe(2);
  });

  it("acha o maior valor de toda a série, com classe e período", () => {
    expect(summarizeChartRows(rows, series)?.peak).toEqual({
      seriesLabel: "Seca fraca",
      periodLabel: "2023",
      value: 90,
    });
  });

  it("ignora o período sem medida ao escolher quem lidera no fim", () => {
    expect(summarizeChartRows(rows, series)?.latestLeader).toEqual({
      seriesLabel: "Sem seca",
      periodLabel: "2024",
      value: 55,
    });
  });

  it("não resume uma série vazia", () => {
    expect(summarizeChartRows([], series)).toBeNull();
    expect(summarizeChartRows(rows, [])).toBeNull();
  });
});

describe("describeChartSummary", () => {
  it("monta as três frases com o valor já formatado", () => {
    const text = describeChartSummary(
      summarizeChartRows(rows, series),
      new EchoTranslator().translate,
      (value) => `${value}%`,
    );

    expect(text).toBe(
      "range(2022|2024|2) peak(Seca fraca|90%|2023) latest(Sem seca|55%|2024)",
    );
  });

  it("fica vazio sem resumo, para o gráfico não apontar para nada", () => {
    expect(
      describeChartSummary(null, new EchoTranslator().translate, String),
    ).toBe("");
  });
});
