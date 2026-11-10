"use client";

import {
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useDeferredValue,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocale, useTranslations } from "next-intl";
import type {
  CompactAnalysisClass,
  CompactAnalysisYearData,
} from "@/utils/analysis";
import { formatDekadPeriod, parseDekadPeriod } from "@/utils/dekadPeriod";
import { formatAbsoluteNumber } from "@/utils/formatTerritorialNumber";
import {
  ChartDataTable,
  ChartDescription,
  useChartSummaryText,
} from "@/components/ChartDataTable/ChartDataTable";
import type { ChartTableSeries } from "@/utils/chartAccessibility";
import {
  buildTemporalTableRows,
  toClassLabelSlug,
} from "./temporalVisionData";
import {
  fitLabel,
  niceAxisMax,
  pickAxisTicks,
  shortenLabel,
  spreadLabelPositions,
  strokeOnWhite,
  temporalRangeOptions,
  type TemporalRangeKey,
  visibleRange,
} from "./temporalVisionChart";

export { buildSeriesData, buildTemporalTableRows } from "./temporalVisionData";

interface TemporalVisionProps {
  years?: Record<string, CompactAnalysisYearData>;
  classes?: CompactAnalysisClass[];
  selectedState?: string;
  valueType?: "percentage" | "absolute";
  valueUnit?: string;
}

const DEFAULT_WIDTH = 366;
const CHART_HEIGHT = 236;
const MARGIN = { top: 20, bottom: 26 };
const LABEL_COLUMN_MAX = 132;
const LABEL_GAP = 14;
const MAX_END_LABELS = 7;
const LABEL_NAME_LENGTH = 13;
const LABEL_OFFSET = 16;
const LABEL_FONT_SIZE = 11.5;
// Uma classe com menos de 1% da área não ganha rótulo na ponta: ela vai na
// frase de baixo, para os rótulos não se empilharem no zero.
const MIN_LABELED_SHARE = 1;
const MAX_POINTS_WITH_DOTS = 12;

const TEXT_COLOR = "#292829";
const MUTED_COLOR = "#6F6F6F";
const GRID_COLOR = "#EEEFEC";
const BASELINE_COLOR = "#C8CAC5";
const CROSSHAIR_COLOR = "#9A9C93";

function linePath(
  values: Array<number | null>,
  start: number,
  end: number,
  x: (index: number) => number,
  y: (value: number) => number,
) {
  let path = "";
  let penDown = false;
  for (let index = start; index <= end; index += 1) {
    const value = values[index];
    if (value === null || value === undefined) {
      penDown = false;
      continue;
    }
    path += `${penDown ? "L" : "M"}${x(index).toFixed(1)} ${y(value).toFixed(1)}`;
    penDown = true;
  }
  return path;
}

export function TemporalVision({
  years,
  classes,
  selectedState = "br",
  valueType = "percentage",
  valueUnit,
}: TemporalVisionProps) {
  const t = useTranslations("AnalysisPanel");
  const tCaption = useTranslations("PlatformMapCaption");
  const tA11y = useTranslations("ChartAccessibility");
  const locale = useLocale();
  const deferredSelectedState = useDeferredValue(selectedState);
  const descriptionId = useId();
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [rangeKey, setRangeKey] = useState<TemporalRangeKey>("recent");
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const measureRef = useRef<SVGTextElement | null>(null);
  const [fittedNames, setFittedNames] = useState<string[] | null>(null);

  const translateClassLabel = useCallback(
    (label: string) => {
      const slug = toClassLabelSlug(label);
      return tCaption.has(`labels.${slug}`)
        ? tCaption(`labels.${slug}`)
        : label;
    },
    [tCaption],
  );
  const tableSeries = useMemo<ChartTableSeries[]>(
    () =>
      (classes ?? []).map((cls, classIndex) => ({
        id: String(classIndex),
        label: translateClassLabel(cls.label),
      })),
    [classes, translateClassLabel],
  );
  const tableRows = useMemo(
    () =>
      years && classes
        ? buildTemporalTableRows(years, classes, deferredSelectedState)
        : [],
    [years, classes, deferredSelectedState],
  );
  const formatValue = useCallback(
    (value: number) =>
      valueType === "absolute"
        ? `${value} ${valueUnit ?? ""}`.trim()
        : `${value}%`,
    [valueType, valueUnit],
  );
  const description = useChartSummaryText(tableRows, tableSeries, formatValue);
  const isDekadSeries = useMemo(
    () => Object.keys(years ?? {}).some((key) => parseDekadPeriod(key)),
    [years],
  );

  useLayoutEffect(() => {
    const element = wrapperRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry.contentRect.width);
      if (next > 0) setWidth(next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const periods = useMemo(
    () => tableRows.map((row) => row.period),
    [tableRows],
  );
  const series = useMemo(
    () =>
      (classes ?? []).map((cls, classIndex) => ({
        label: tableSeries[classIndex]?.label ?? cls.label,
        color: cls.color,
        stroke: strokeOnWhite(cls.color),
        values: tableRows.map((row) => row.values[String(classIndex)] ?? null),
      })),
    [classes, tableRows, tableSeries],
  );

  const rangeOptions = useMemo(
    () => temporalRangeOptions(periods.length, isDekadSeries),
    [periods.length, isDekadSeries],
  );
  const [start, end] = visibleRange(periods.length, rangeOptions, rangeKey);
  const activeRangeKey =
    rangeOptions?.find((option) => option.key === rangeKey)?.key ??
    rangeOptions?.[0]?.key;

  const numberFormat = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [locale],
  );
  const formatLabelValue = useCallback(
    (value: number) => {
      if (valueType === "absolute") return formatAbsoluteNumber(value, locale);
      if (value > 0 && value < 0.05) return `<${numberFormat.format(0.1)}%`;
      return `${numberFormat.format(value)}%`;
    },
    [valueType, locale, numberFormat],
  );
  const formatPeriod = useCallback(
    (period: string) =>
      isDekadSeries ? (formatDekadPeriod(period, locale) ?? period) : period,
    [isDekadSeries, locale],
  );
  const formatMonth = useCallback(
    (year: number, month: number) => {
      const name = new Intl.DateTimeFormat(locale, {
        month: "short",
        timeZone: "UTC",
      })
        .format(new Date(Date.UTC(year, month - 1, 1)))
        .replace(".", "");
      return `${name}/${String(year).slice(2)}`;
    },
    [locale],
  );

  const yMax = useMemo(() => {
    if (valueType === "percentage") return 100;
    let max = 0;
    for (const item of series) {
      for (let index = start; index <= end; index += 1) {
        max = Math.max(max, item.values[index] ?? 0);
      }
    }
    return niceAxisMax(max);
  }, [valueType, series, start, end]);
  const yTicks = [0, yMax / 2, yMax];
  const formatTick = (value: number) =>
    valueType === "percentage"
      ? `${value}%`
      : formatAbsoluteNumber(value, locale);

  const left = Math.max(
    30,
    Math.max(...yTicks.map((tick) => formatTick(tick).length)) * 6 + 8,
  );
  const labelColumn = Math.min(LABEL_COLUMN_MAX, Math.round(width * 0.36));
  const plotWidth = Math.max(80, width - left - labelColumn);
  const plotHeight = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;
  const plotRight = left + plotWidth;
  const innerPad = end - start <= MAX_POINTS_WITH_DOTS ? 18 : 0;
  const x = useCallback(
    (index: number) =>
      left +
      innerPad +
      (end === start ? 0.5 : (index - start) / (end - start)) *
        (plotWidth - innerPad * 2),
    [left, innerPad, plotWidth, start, end],
  );
  const y = useCallback(
    (value: number) =>
      MARGIN.top + plotHeight - (Math.min(value, yMax) / yMax) * plotHeight,
    [plotHeight, yMax],
  );

  // A fonte da plataforma é mais larga que uma conta por número de letras:
  // cada nome é medido no próprio SVG e cortado só se não couber ao lado do
  // maior valor possível.
  const widestValue = formatLabelValue(yMax);
  useLayoutEffect(() => {
    const node = measureRef.current;
    if (!node || typeof node.getComputedTextLength !== "function") return;
    const widthOf = (text: string, bold: boolean) => {
      node.setAttribute("font-weight", bold ? "700" : "400");
      node.textContent = text;
      return node.getComputedTextLength();
    };
    const budget =
      labelColumn - LABEL_OFFSET - widthOf(`${widestValue} `, true) - 4;
    const names = series.map((item) =>
      fitLabel(item.label, budget, (text) => widthOf(text, false)),
    );
    node.textContent = "";
    setFittedNames(names);
  }, [series, labelColumn, widestValue]);

  // As linhas só mudam com os dados, o período ou a largura; o mouse mexe
  // apenas na mira e nos rótulos.
  const lines = useMemo(
    () =>
      series.map((item) => ({
        ...item,
        path: linePath(item.values, start, end, x, y),
        dots:
          end - start <= MAX_POINTS_WITH_DOTS
            ? Array.from({ length: end - start + 1 }, (_, i) => start + i)
            : [end],
      })),
    [series, start, end, x, y],
  );
  const axisTicks = useMemo(
    () =>
      pickAxisTicks(periods, start, end, isDekadSeries, plotWidth, formatMonth),
    [periods, start, end, isDekadSeries, plotWidth, formatMonth],
  );

  if (!years || !classes || periods.length === 0) {
    return null;
  }

  const activeIndex =
    hoverIndex !== null && hoverIndex >= start && hoverIndex <= end
      ? hoverIndex
      : end;
  const labelThreshold =
    valueType === "percentage" ? MIN_LABELED_SHARE : yMax / 100;
  const candidates = series
    .map((item, classIndex) => ({
      ...item,
      classIndex,
      value: item.values[activeIndex],
    }))
    .filter(
      (item): item is typeof item & { value: number } =>
        typeof item.value === "number" && item.value > 0,
    )
    .sort((first, second) => second.value - first.value);
  const labeled = candidates
    .filter((item) => item.value >= labelThreshold)
    .slice(0, MAX_END_LABELS);
  const unlabeled = candidates.filter((item) => !labeled.includes(item));
  const labelPositions = spreadLabelPositions(
    labeled.map((item) => y(item.value)),
    {
      top: MARGIN.top + 4,
      bottom: MARGIN.top + plotHeight,
      gap: LABEL_GAP,
    },
  );
  const allUnlabeledAreSmall = unlabeled.every(
    (item) => item.value < labelThreshold,
  );
  const unlabeledText =
    unlabeled.length > 0
      ? t(
          allUnlabeledAreSmall && valueType === "percentage"
            ? "temporalBelowOnePercent"
            : "temporalUnlabeledClasses",
          {
            period: formatPeriod(periods[activeIndex]),
            classes: new Intl.ListFormat(locale, {
              style: "long",
              type: "conjunction",
            }).format(unlabeled.map((item) => item.label)),
          },
        )
      : "";

  const pickIndex = (event: PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const pointerX = ((event.clientX - bounds.left) / bounds.width) * width;
    if (pointerX < left - 8 || pointerX > plotRight + 8) {
      setHoverIndex(null);
      return;
    }
    const span = x(end) - x(start);
    const ratio = span > 0 ? (pointerX - x(start)) / span : 1;
    const index = Math.round(start + ratio * (end - start));
    setHoverIndex(Math.max(start, Math.min(end, index)));
  };
  const handleKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const step = end - start > 60 ? 3 : 1;
    const direction = event.key === "ArrowRight" ? step : -step;
    setHoverIndex(Math.max(start, Math.min(end, activeIndex + direction)));
  };

  const crosshairX = x(activeIndex);
  const periodLabelX = Math.max(left + 40, Math.min(plotRight - 40, crosshairX));
  const labelX = plotRight + LABEL_OFFSET;

  return (
    <div className="flex flex-col gap-2">
      <div className="h-6">
        <h2 className="text-[1.125rem] font-semibold leading-6 text-[#292829]">
          {t("temporalVision")}
        </h2>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-[#EFEFEF] bg-white p-3 shadow-sm">
        <div className="flex min-h-7 flex-wrap items-center justify-between gap-2">
          <span className="text-[0.6875rem] text-[#6F6F6F]">
            {valueType === "percentage"
              ? t("temporalAxisPercent")
              : (valueUnit ?? "")}
          </span>
          {rangeOptions ? (
            <div
              role="group"
              aria-label={t("temporalRangeGroup")}
              className="inline-flex gap-[2px] rounded-md border border-[#DCDBDC] bg-white p-[2px]"
            >
              {rangeOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={option.key === activeRangeKey}
                  onClick={() => {
                    setRangeKey(option.key);
                    setHoverIndex(null);
                  }}
                  className="cursor-pointer rounded px-2 py-1.5 text-[0.75rem] font-semibold leading-none text-neutral-600 aria-pressed:bg-[#5B612A] aria-pressed:text-white"
                >
                  {option.key === "recent"
                    ? isDekadSeries
                      ? t("temporalRange.lastYear")
                      : t("temporalRange.lastPeriods", { count: option.size })
                    : option.key === "fiveYears"
                      ? t("temporalRange.fiveYears")
                      : t("temporalRange.all")}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div ref={wrapperRef} className="w-full">
          <svg
            viewBox={`0 0 ${width} ${CHART_HEIGHT}`}
            width={width}
            height={CHART_HEIGHT}
            className="block h-auto w-full touch-pan-y select-none outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#5B612A]"
            role="img"
            tabIndex={0}
            aria-label={tA11y("temporalVisionLabel")}
            aria-describedby={description ? descriptionId : undefined}
            onPointerMove={pickIndex}
            onPointerDown={pickIndex}
            onPointerLeave={() => setHoverIndex(null)}
            onKeyDown={handleKeyDown}
            onBlur={() => setHoverIndex(null)}
            style={{ fontFamily: "inherit" }}
          >
            {yTicks.map((tick) => (
              <g key={tick}>
                <line
                  x1={left}
                  x2={plotRight}
                  y1={y(tick)}
                  y2={y(tick)}
                  stroke={tick === 0 ? BASELINE_COLOR : GRID_COLOR}
                />
                <text
                  x={left - 6}
                  y={y(tick) + 4}
                  textAnchor="end"
                  fontSize={11}
                  fill={MUTED_COLOR}
                >
                  {formatTick(tick)}
                </text>
              </g>
            ))}
            {axisTicks.map((tick) => (
              <text
                key={tick.index}
                x={x(tick.index)}
                y={CHART_HEIGHT - 6}
                textAnchor="middle"
                fontSize={11}
                fill={MUTED_COLOR}
              >
                {tick.label}
              </text>
            ))}

            {lines.map((line, classIndex) => (
              <g key={`${classIndex}-${line.color}`}>
                <path
                  d={line.path}
                  fill="none"
                  stroke={line.stroke}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {line.dots.map((index) => {
                  const value = line.values[index];
                  return typeof value === "number" ? (
                    <circle
                      key={index}
                      cx={x(index)}
                      cy={y(value)}
                      r={index === end ? 3.5 : 2.5}
                      fill={line.stroke}
                      stroke="#FFFFFF"
                      strokeWidth={1.5}
                    />
                  ) : null;
                })}
              </g>
            ))}

            {hoverIndex !== null && activeIndex === hoverIndex ? (
              <g pointerEvents="none">
                <line
                  x1={crosshairX}
                  x2={crosshairX}
                  y1={MARGIN.top}
                  y2={MARGIN.top + plotHeight}
                  stroke={CROSSHAIR_COLOR}
                />
                <text
                  x={periodLabelX}
                  y={MARGIN.top - 7}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={700}
                  fill={TEXT_COLOR}
                >
                  {formatPeriod(periods[activeIndex])}
                </text>
                {series.map((item, classIndex) => {
                  const value = item.values[activeIndex];
                  return typeof value === "number" ? (
                    <circle
                      key={classIndex}
                      cx={crosshairX}
                      cy={y(value)}
                      r={4}
                      fill={item.stroke}
                      stroke="#FFFFFF"
                      strokeWidth={2}
                    />
                  ) : null;
                })}
              </g>
            ) : null}

            <text
              ref={measureRef}
              x={0}
              y={0}
              fontSize={LABEL_FONT_SIZE}
              visibility="hidden"
              aria-hidden="true"
            />
            <g pointerEvents="none">
              {labeled.map((item, position) => {
                const lineY = y(item.value);
                const labelY = labelPositions[position];
                return (
                  <g key={item.classIndex}>
                    <path
                      d={`M${crosshairX + 6} ${lineY}L${plotRight + 4} ${lineY}L${labelX - 3} ${labelY}`}
                      fill="none"
                      stroke={item.stroke}
                      strokeOpacity={0.5}
                    />
                    <text x={labelX} y={labelY + 4} fontSize={LABEL_FONT_SIZE}>
                      <title>{item.label}</title>
                      <tspan fontWeight={700} fill={TEXT_COLOR}>
                        {formatLabelValue(item.value)}{" "}
                      </tspan>
                      <tspan fill="#525252">
                        {fittedNames?.[item.classIndex] ??
                          shortenLabel(item.label, LABEL_NAME_LENGTH)}
                      </tspan>
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {unlabeledText ? (
          <p className="text-[0.75rem] leading-4 text-[#6F6F6F]">
            {unlabeledText}
          </p>
        ) : null}
      </div>
      <ChartDescription id={descriptionId} text={description} />
      <ChartDataTable
        caption={t("temporalVision")}
        series={tableSeries}
        rows={tableRows}
        formatValue={formatValue}
      />
    </div>
  );
}
