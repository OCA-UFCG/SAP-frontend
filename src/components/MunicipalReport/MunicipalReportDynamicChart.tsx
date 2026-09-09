"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import {
  buildMunicipalReportChartData,
  getVisibleChartColor,
} from "@/utils/municipalReportChart";
import { formatMunicipalReportValue } from "@/utils/municipalReportValue";

type DynamicChartRow = {
  period: string;
  label: string;
  highlighted: boolean;
  [seriesId: string]: string | number | boolean;
};

/**
 * O gráfico de série histórica do Relatório Automático, com as classes
 * ligáveis pela legenda.
 *
 * É um componente próprio porque a prévia do catálogo desenha o mesmo gráfico
 * antes de o índice existir em produção — duas cópias divergiriam no dia em que
 * uma delas mudasse de escala ou de cor.
 *
 * @example
 * <MunicipalReportDynamicChart
 *   analysis={analysis}
 *   locale="pt-BR"
 *   referencePeriod="2024"
 *   translateLabel={(label) => label}
 * />
 */
export function MunicipalReportDynamicChart({
  analysis,
  locale,
  referencePeriod,
  translateLabel,
}: {
  analysis: MunicipalReportAnalysis;
  locale: string;
  referencePeriod: string;
  translateLabel: (label: string) => string;
}) {
  const chartData = useMemo(
    () => buildMunicipalReportChartData(analysis, referencePeriod),
    [analysis, referencePeriod],
  );
  const [activeSeries, setActiveSeries] = useState(
    () => new Set(chartData.series.map((series) => series.id)),
  );
  const seriesById = useMemo(
    () => new Map(chartData.series.map((series) => [series.id, series])),
    [chartData.series],
  );
  const rows = useMemo(
    () =>
      chartData.categories.map((category, index) => {
        const row: DynamicChartRow = {
          period: category.period,
          label: category.label,
          highlighted: category.highlighted,
        };
        chartData.series.forEach((series) => {
          row[series.id] = series.points[index]?.value ?? 0;
        });
        return row;
      }),
    [chartData.categories, chartData.series],
  );
  const periodLabels = useMemo(
    () =>
      new Map(
        chartData.categories.map((category) => [
          category.period,
          category.label,
        ]),
      ),
    [chartData.categories],
  );
  const visibleSeries = chartData.series.filter((series) =>
    activeSeries.has(series.id),
  );
  const observedMax = Math.max(
    0,
    ...chartData.series.flatMap((series) =>
      series.points.map((point) => point.value),
    ),
  );
  const axisMax =
    analysis.valueType === "absolute"
      ? Math.max(1, Math.ceil(observedMax / 5) * 5)
      : 100;
  const yTicks = Array.from({ length: 6 }, (_, index) => (axisMax / 5) * index);
  const referenceLinePeriod = chartData.categories.some(
    (category) => category.period === chartData.referencePeriod,
  )
    ? chartData.referencePeriod
    : null;

  function toggleSeries(seriesId: string) {
    setActiveSeries((current) => {
      const next = new Set(current);
      if (next.has(seriesId)) {
        if (next.size > 1) next.delete(seriesId);
      } else {
        next.add(seriesId);
      }
      return next;
    });
  }

  function renderTooltip({ active, label, payload }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    const period = label == null ? "" : String(label);
    const periodLabel = periodLabels.get(period) ?? period;

    return (
      <div className="rounded border border-[#d9e0e3] bg-white px-3 py-2 text-xs shadow-lg">
        <p className="font-bold text-[#536e7b]">{periodLabel}</p>
        <div className="mt-2 space-y-1">
          {payload
            .filter((entry) => typeof entry.dataKey === "string")
            .map((entry) => {
              const series = seriesById.get(String(entry.dataKey));
              if (!series) return null;
              const numericValue = Number(entry.value ?? 0);
              const visibleColor = getVisibleChartColor(series.color);
              return (
                <p
                  key={series.id}
                  className="flex items-center justify-between gap-4 text-neutral-700"
                >
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: visibleColor }}
                    />
                    {translateLabel(series.label)}
                  </span>
                  <strong>
                    {formatMunicipalReportValue(numericValue, analysis, locale)}
                  </strong>
                </p>
              );
            })}
        </div>
      </div>
    );
  }

  if (rows.length === 0 || chartData.series.length === 0) {
    return (
      <span className="text-sm text-neutral-500">
        Série temporal indisponível para visualização dinâmica.
      </span>
    );
  }

  return (
    <div className="flex h-full min-h-[320px] w-full flex-col gap-3">
      <div className="min-h-[255px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={rows}
            margin={{ top: 20, right: 28, bottom: 18, left: 8 }}
          >
            <CartesianGrid
              stroke="#E3E7EA"
              strokeDasharray="4 6"
              vertical={false}
            />
            <XAxis
              dataKey="period"
              tickFormatter={(value) =>
                periodLabels.get(String(value)) ?? String(value)
              }
              tick={{ fill: "#5F6670", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#B8C0C5" }}
              minTickGap={12}
              height={38}
              tickMargin={10}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[0, axisMax]}
              ticks={yTicks}
              tickFormatter={(value) =>
                analysis.valueType === "percentage"
                  ? `${Number(value).toFixed(0)}%`
                  : new Intl.NumberFormat(locale, {
                      maximumFractionDigits: 0,
                    }).format(Number(value))
              }
              tick={{ fill: "#5F6670", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#B8C0C5" }}
              width={62}
              tickMargin={8}
            />
            {referenceLinePeriod && (
              <ReferenceLine
                x={referenceLinePeriod}
                stroke="#989F43"
                strokeDasharray="4 4"
                strokeWidth={2}
              />
            )}
            <Tooltip
              content={renderTooltip}
              cursor={{ stroke: "#8A9340", strokeWidth: 1.25 }}
            />
            {visibleSeries.map((series) => (
              <Line
                key={series.id}
                type="linear"
                dataKey={series.id}
                name={translateLabel(series.label)}
                stroke={getVisibleChartColor(series.color)}
                strokeWidth={2}
                strokeOpacity={0.92}
                dot={{ r: 2.2, strokeWidth: 1.6, fill: "#FFFFFF" }}
                activeDot={{ r: 4.4, strokeWidth: 2, fill: "#FFFFFF" }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-2">
        {chartData.series.map((series) => {
          const enabled = activeSeries.has(series.id);
          return (
            <button
              key={series.id}
              type="button"
              aria-pressed={enabled}
              onClick={() => toggleSeries(series.id)}
              className={`inline-flex items-center gap-2 rounded border px-2.5 py-1.5 text-xs font-semibold transition ${
                enabled
                  ? "border-[#c8ced1] bg-white text-[#292829]"
                  : "border-[#d9e0e3] bg-[#f4f6f8] text-neutral-500"
              }`}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: getVisibleChartColor(series.color) }}
              />
              {translateLabel(series.label)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
