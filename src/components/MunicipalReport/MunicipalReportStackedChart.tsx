"use client";

import { useCallback, useId, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";
import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import {
  buildStackedChartData,
  MUNICIPAL_REPORT_STACKED_MAX_COLUMNS,
} from "@/utils/municipalReportStackedChart";
import {
  ChartDataTable,
  ChartDescription,
  useChartSummaryText,
} from "@/components/ChartDataTable/ChartDataTable";
import type {
  ChartTableRow,
  ChartTableSeries,
} from "@/utils/chartAccessibility";

const Y_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export function MunicipalReportStackedChart({
  analysis,
  locale,
  referencePeriod,
  translateLabel,
}: {
  analysis: MunicipalReportAnalysis;
  locale: string;
  referencePeriod: string | null;
  translateLabel: (label: string) => string;
}) {
  const data = useMemo(
    () =>
      buildStackedChartData(
        analysis,
        referencePeriod,
        MUNICIPAL_REPORT_STACKED_MAX_COLUMNS,
      ),
    [analysis, referencePeriod],
  );

  const rows = useMemo(
    () =>
      data.rows.map((row) => ({
        period: row.period,
        axisLabel: row.highlighted ? `${row.period}*` : row.period,
        ...row.shares,
        ...Object.fromEntries(
          Object.entries(row.raw).map(([id, value]) => [`raw:${id}`, value]),
        ),
      })),
    [data],
  );

  const seriesById = useMemo(
    () => new Map(data.series.map((series) => [series.id, series])),
    [data],
  );

  const tA11y = useTranslations("ChartAccessibility");
  const descriptionId = useId();
  const tableSeries = useMemo<ChartTableSeries[]>(
    () =>
      data.series.map((series) => ({
        id: series.id,
        label: translateLabel(series.label),
      })),
    [data, translateLabel],
  );
  // A tabela traz o percentual como o serviço produziu, o mesmo do tooltip, e
  // não as fatias arredondadas para fechar 100 no desenho.
  const tableRows = useMemo<ChartTableRow[]>(
    () =>
      data.rows.map((row) => ({
        period: row.period,
        label: row.period,
        values: row.raw,
      })),
    [data],
  );
  const formatValue = useCallback(
    (value: number) =>
      `${new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }).format(value)}%`,
    [locale],
  );
  const description = useChartSummaryText(tableRows, tableSeries, formatValue);

  function renderTooltip({ active, label, payload }: TooltipContentProps) {
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as Record<string, number | string>;

    return (
      <div className="rounded-md border border-[#D3DCD5] bg-white px-3 py-2 text-xs shadow-sm">
        <p className="font-semibold text-[#2C3A31]">
          {label == null ? "" : String(label)}
        </p>
        <div className="mt-1.5 space-y-1">
          {data.series.map((series) => {
            const value = Number(row?.[`raw:${series.id}`] ?? 0);
            if (value <= 0) return null;

            return (
              <p
                key={series.id}
                className="flex items-center justify-between gap-4 text-[#58655C]"
              >
                <span className="inline-flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: series.color }}
                  />
                  {translateLabel(series.label)}
                </span>
                <strong className="tabular-nums text-[#2C3A31]">
                  {new Intl.NumberFormat(locale, {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  }).format(value)}
                  %
                </strong>
              </p>
            );
          })}
        </div>
      </div>
    );
  }

  if (rows.length === 0 || data.series.length === 0) return null;

  return (
    <div className="w-full">
      {/* Só o desenho é `img`: com o papel no contêiner inteiro, a legenda e a
          tabela abaixo virariam parte da imagem e sumiriam do leitor de tela. */}
      <div
        role="img"
        aria-label={`${tA11y("reportChartLabel", { title: analysis.title })}: ${data.firstPeriod} – ${data.lastPeriod}`}
        aria-describedby={description ? descriptionId : undefined}
        className="aspect-[696/322] w-full"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            margin={{ top: 8, right: 8, bottom: 8, left: 0 }}
          >
            <CartesianGrid stroke="#E4EBE5" vertical={false} />
            <XAxis
              dataKey="axisLabel"
              tick={{ fill: "#58655C", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "#D3DCD5" }}
              // Todo período desenhado mostra a própria data: uma barra sem
              // rótulo não diz de quando é.
              interval={0}
              tickMargin={8}
              height={34}
            />
            <YAxis
              domain={[0, 100]}
              ticks={Y_TICKS}
              tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
              tick={{ fill: "#58655C", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={46}
              tickMargin={6}
            />
            <Tooltip content={renderTooltip} cursor={{ fill: "#2C3A3110" }} />
            {data.series.map((series, index) => (
              <Bar
                key={series.id}
                dataKey={series.id}
                name={translateLabel(series.label)}
                stackId="classes"
                fill={series.color}
                stroke="#00000022"
                strokeWidth={0.5}
                isAnimationActive={false}
                radius={
                  index === data.series.length - 1 ? [2, 2, 0, 0] : undefined
                }
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <ChartDescription id={descriptionId} text={description} />

      <ul
        aria-label={tA11y("legendLabel")}
        className="mt-4 flex flex-wrap content-center items-center gap-x-4 gap-y-2"
      >
        {[...seriesById.values()].map((series) => (
          <li
            key={series.id}
            className="font-open-sans flex items-center gap-1.5 rounded border border-[#EFEFEF] bg-white p-2 text-xs font-semibold text-[#292829]"
          >
            <span
              aria-hidden="true"
              className="size-3.5 rounded-full border border-black/10"
              style={{ backgroundColor: series.color }}
            />
            {translateLabel(series.label)}
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <ChartDataTable
          caption={analysis.title}
          series={tableSeries}
          rows={tableRows}
          formatValue={formatValue}
        />
      </div>
    </div>
  );
}
