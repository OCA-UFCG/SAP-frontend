/**
 * Os dados de um gráfico em linhas e colunas, no formato que serve tanto à
 * tabela alternativa quanto ao resumo lido pelo leitor de tela.
 *
 * Os gráficos do SEDES (amCharts e Recharts) só existem como desenho: quem não
 * enxerga a tela não tem acesso a nenhum valor. A LBI (art. 63) e a WCAG 1.1.1
 * pedem uma alternativa em texto com a mesma informação — é esta.
 */
export interface ChartTableSeries {
  id: string;
  label: string;
}

export interface ChartTableRow {
  /** Chave estável do período (ex.: "2024-05"). */
  period: string;
  /** Como o período aparece para a pessoa (ex.: "mai/2024"). */
  label: string;
  /** Valor de cada série neste período; `null` quando não há medida. */
  values: Record<string, number | null>;
}

export interface ChartPoint {
  seriesLabel: string;
  periodLabel: string;
  value: number;
}

export interface ChartSeriesSummary {
  firstPeriod: string;
  lastPeriod: string;
  seriesCount: number;
  /** O maior valor de toda a série, com a classe e o período em que ocorreu. */
  peak: ChartPoint | null;
  /** A classe de maior valor no último período — o "como está agora". */
  latestLeader: ChartPoint | null;
}

function highestPoint(
  row: ChartTableRow,
  series: ChartTableSeries[],
): ChartPoint | null {
  let best: ChartPoint | null = null;
  for (const item of series) {
    const value = row.values[item.id];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    if (best && best.value >= value) continue;
    best = { seriesLabel: item.label, periodLabel: row.label, value };
  }
  return best;
}

/**
 * Resume a série para a descrição acessível do gráfico: de quando a quando,
 * quantas classes, o pico e quem lidera no último período.
 *
 * @example
 * summarizeChartRows(
 *   [{ period: "2024", label: "2024", values: { seca: 12 } }],
 *   [{ id: "seca", label: "Seca fraca" }],
 * );
 * // { firstPeriod: "2024", lastPeriod: "2024", seriesCount: 1, peak: {...}, latestLeader: {...} }
 */
export function summarizeChartRows(
  rows: ChartTableRow[],
  series: ChartTableSeries[],
): ChartSeriesSummary | null {
  if (rows.length === 0 || series.length === 0) return null;

  const peak = rows.reduce<ChartPoint | null>((best, row) => {
    const candidate = highestPoint(row, series);
    if (!candidate) return best;
    return best && best.value >= candidate.value ? best : candidate;
  }, null);

  return {
    firstPeriod: rows[0].label,
    lastPeriod: rows[rows.length - 1].label,
    seriesCount: series.length,
    peak,
    latestLeader: highestPoint(rows[rows.length - 1], series),
  };
}

type SummaryTranslator = (
  key: "range" | "peak" | "latest",
  values: Record<string, string | number>,
) => string;

/**
 * Transforma o resumo em frases, com o valor já formatado por quem desenha o
 * gráfico (percentual, mm, número absoluto).
 *
 * @example
 * describeChartSummary(summary, t, (value) => `${value}%`);
 * // "Dados de 2001 a 2024, 5 classes. Maior valor: Seca fraca, 40% em 2012. ..."
 */
export function describeChartSummary(
  summary: ChartSeriesSummary | null,
  translate: SummaryTranslator,
  formatValue: (value: number) => string,
): string {
  if (!summary) return "";
  const sentences = [
    translate("range", {
      first: summary.firstPeriod,
      last: summary.lastPeriod,
      count: summary.seriesCount,
    }),
  ];
  if (summary.peak) {
    sentences.push(
      translate("peak", {
        series: summary.peak.seriesLabel,
        value: formatValue(summary.peak.value),
        period: summary.peak.periodLabel,
      }),
    );
  }
  if (summary.latestLeader) {
    sentences.push(
      translate("latest", {
        series: summary.latestLeader.seriesLabel,
        value: formatValue(summary.latestLeader.value),
        period: summary.latestLeader.periodLabel,
      }),
    );
  }
  return sentences.join(" ");
}
