"use client";

import {
  useEffect,
  memo,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type Ref,
} from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
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
import type {
  MunicipalReportAnalysis,
  MunicipalReportData,
  MunicipalReportDocsContent,
} from "@/contracts/municipalReport";
import { getMunicipalReportPresentation } from "@/config/municipalReport";
import {
  buildAnalysisNarrativeSections,
  buildSituationNarrative,
  formatReportPeriod,
  getReportDocsText,
} from "@/utils/municipalReportNarrative";
import {
  finishMunicipalReportMetrics,
  recordMunicipalReportNavigation,
  startMunicipalReportStage,
} from "@/utils/municipalReportMetrics";
import {
  formatMunicipalReportValue,
  getMunicipalReportValueLabels,
} from "@/utils/municipalReportValue";
import {
  buildMunicipalReportChartData,
  MUNICIPAL_REPORT_PDF_CHART_MAX_MEASUREMENTS,
  selectMunicipalReportChartSnapshots,
} from "@/utils/municipalReportChart";
import { slugifyTranslationKey } from "@/utils/translations";
import { ReportMapPreview } from "./ReportMapPreview";
import { useReportMapCaptureQueue } from "./useReportMapCaptureQueue";

interface MunicipalReportPreviewProps {
  municipalityCode: string;
  period: string;
  layerIds?: string[];
  embedded?: boolean;
}

type DynamicChartRow = {
  period: string;
  label: string;
  highlighted: boolean;
  [seriesId: string]: string | number | boolean;
};

function textColorForBackground(color: string) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
  return red * 0.299 + green * 0.587 + blue * 0.114 > 170
    ? "#202020"
    : "#ffffff";
}

function parseHexColor(color: string) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  const [red, green, blue] = [0, 2, 4].map((offset) =>
    Number.parseInt(hex.slice(offset, offset + 2), 16),
  );
  return { red, green, blue };
}

function toHex(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");
}

function getVisibleChartColor(color: string) {
  const parsed = parseHexColor(color);
  if (!parsed) return "#536E7B";

  const luminance =
    parsed.red * 0.299 + parsed.green * 0.587 + parsed.blue * 0.114;
  if (luminance <= 190) return color;

  return `#${toHex(parsed.red * 0.72)}${toHex(parsed.green * 0.72)}${toHex(parsed.blue * 0.72)}`;
}

function compactPeriodRange(
  timeSeries: MunicipalReportAnalysis["timeSeries"],
  fallback: string,
  locale: string,
  t?: (key: string, values?: Record<string, string>) => string,
) {
  const firstPeriod = timeSeries[0]?.period ?? fallback;
  const lastPeriod = timeSeries.at(-1)?.period ?? fallback;
  const firstLabel = formatReportPeriod(firstPeriod, locale);
  const lastLabel = formatReportPeriod(lastPeriod, locale);
  if (firstPeriod === lastPeriod) return firstLabel;
  if (t) return t("periodRange", { first: firstLabel, last: lastLabel });
  return `${firstLabel} a ${lastLabel}`;
}

function buildReportFilename(
  report: MunicipalReportData | null,
  period: string,
  fallback: string,
  prefix: string,
) {
  if (!report) return fallback;
  const municipality = report.municipality.name.trim().replace(/\s+/g, "-");
  return `${prefix}-${municipality}-${period}.pdf`;
}

function slugifyLabelKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/</g, "menor-que")
    .replace(/>/g, "maior-que")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

function translateAnalysisTitle(
  analysis: MunicipalReportAnalysis,
  tReport: (key: string) => string,
  tReportHas: (key: string) => boolean,
  tModules: (key: string) => string,
  tModulesHas: (key: string) => boolean,
) {
  if (tReportHas(`indicators.${analysis.id}.title`)) {
    return tReport(`indicators.${analysis.id}.title`);
  }
  const slug = slugifyTranslationKey(analysis.title);
  if (tReportHas(`indicators.${slug}.title`)) {
    return tReport(`indicators.${slug}.title`);
  }
  const moduleKey = `Layers.${slug}.title`;
  if (tModulesHas(moduleKey)) {
    return tModules(moduleKey);
  }
  return analysis.title;
}

function translateClassLabel(
  label: string,
  tReport: (key: string) => string,
  tReportHas: (key: string) => boolean,
  tCaption: (key: string) => string,
  tCaptionHas: (key: string) => boolean,
) {
  const slug = slugifyLabelKey(label);
  if (tCaptionHas(`labels.${slug}`)) {
    return tCaption(`labels.${slug}`);
  }
  if (tReportHas(`classes.${slug}`)) {
    return tReport(`classes.${slug}`);
  }
  return label;
}

function translateAnalysisMethodology(
  analysis: MunicipalReportAnalysis,
  docsContent: MunicipalReportDocsContent | null,
  presentationMethodology: string,
  tReport: (key: string) => string,
  tReportHas: (key: string) => boolean,
  tModules: (key: string) => string,
  tModulesHas: (key: string) => boolean,
  locale?: string,
) {
  const docsText = getReportDocsText(docsContent, analysis.title, locale);
  if (docsText) return docsText;

  if (tReportHas(`indicators.${analysis.id}.methodology`)) {
    return tReport(`indicators.${analysis.id}.methodology`);
  }
  const slug = slugifyTranslationKey(analysis.title);
  if (tReportHas(`indicators.${slug}.methodology`)) {
    return tReport(`indicators.${slug}.methodology`);
  }
  const moduleKey = `Layers.${slug}.description`;
  if (tModulesHas(moduleKey)) {
    return tModules(moduleKey);
  }
  if (
    presentationMethodology ===
      "Indicador territorial disponibilizado na plataforma SEDES." &&
    tReportHas("indicators.defaultMethodology")
  ) {
    return tReport("indicators.defaultMethodology");
  }
  return presentationMethodology;
}

function MunicipalReportDynamicChart({
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
                type="monotone"
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

const PRINT_CHART_WIDTH = 640;
const PRINT_CHART_HEIGHT = 280;
const PRINT_CHART_LEFT = 58;
const PRINT_CHART_RIGHT = 16;
const PRINT_CHART_TOP = 14;
const PRINT_CHART_BOTTOM = 232;

function MunicipalReportPrintChart({
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
    () =>
      buildMunicipalReportChartData(analysis, referencePeriod, {
        maxMeasurements: MUNICIPAL_REPORT_PDF_CHART_MAX_MEASUREMENTS,
      }),
    [analysis, referencePeriod],
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
  const plotWidth = PRINT_CHART_WIDTH - PRINT_CHART_LEFT - PRINT_CHART_RIGHT;
  const categoryCount = chartData.categories.length;

  const xForIndex = (index: number) =>
    categoryCount <= 1
      ? PRINT_CHART_LEFT + plotWidth / 2
      : PRINT_CHART_LEFT + (index / (categoryCount - 1)) * plotWidth;
  const yForValue = (value: number) => {
    const clampedValue = Math.max(0, Math.min(axisMax, value));
    return (
      PRINT_CHART_BOTTOM -
      (clampedValue / axisMax) * (PRINT_CHART_BOTTOM - PRINT_CHART_TOP)
    );
  };
  const visiblePeriodIndexes = new Set(
    chartData.categories
      .map((_, index) => index)
      .filter(
        (index) =>
          categoryCount <= 5 ||
          index === 0 ||
          index === categoryCount - 1 ||
          index % 3 === 0,
      ),
  );
  const referenceIndex = chartData.categories.findIndex(
    (category) => category.period === chartData.referencePeriod,
  );

  if (categoryCount === 0 || chartData.series.length === 0) {
    return (
      <span className="text-sm text-neutral-500">
        Série temporal indisponível para impressão.
      </span>
    );
  }

  return (
    <div
      className="w-full"
      data-report-pdf-measurements={categoryCount}
      data-report-pdf-first-period={chartData.categories[0]?.period}
      data-report-pdf-last-period={chartData.categories.at(-1)?.period}
    >
      <svg
        className="report-print-chart-svg block h-auto w-full"
        viewBox={`0 0 ${PRINT_CHART_WIDTH} ${PRINT_CHART_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`${analysis.title}: ${chartData.categories[0]?.period} a ${chartData.categories.at(-1)?.period}`}
      >
        {yTicks.map((value) => {
          const y = yForValue(value);
          const label =
            analysis.valueType === "percentage"
              ? `${Number(value).toFixed(0)}%`
              : new Intl.NumberFormat(locale, {
                  maximumFractionDigits: 0,
                }).format(value);

          return (
            <g key={value}>
              <line
                x1={PRINT_CHART_LEFT}
                y1={y}
                x2={PRINT_CHART_WIDTH - PRINT_CHART_RIGHT}
                y2={y}
                stroke="#E3E7EA"
                strokeDasharray="4 6"
              />
              <text
                x={PRINT_CHART_LEFT - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="14"
                fill="#5F6670"
              >
                {label}
              </text>
            </g>
          );
        })}
        <line
          x1={PRINT_CHART_LEFT}
          y1={PRINT_CHART_TOP}
          x2={PRINT_CHART_LEFT}
          y2={PRINT_CHART_BOTTOM}
          stroke="#B8C0C5"
        />
        <line
          x1={PRINT_CHART_LEFT}
          y1={PRINT_CHART_BOTTOM}
          x2={PRINT_CHART_WIDTH - PRINT_CHART_RIGHT}
          y2={PRINT_CHART_BOTTOM}
          stroke="#B8C0C5"
        />
        {referenceIndex >= 0 && (
          <line
            x1={xForIndex(referenceIndex)}
            y1={PRINT_CHART_TOP}
            x2={xForIndex(referenceIndex)}
            y2={PRINT_CHART_BOTTOM}
            stroke="#989F43"
            strokeDasharray="5 5"
            strokeWidth="2"
          />
        )}
        {chartData.series.map((series) => {
          const color = getVisibleChartColor(series.color);
          const points = series.points
            .map(
              (point, index) =>
                `${xForIndex(index).toFixed(1)},${yForValue(point.value).toFixed(1)}`,
            )
            .join(" ");

          return (
            <g key={series.id}>
              <polyline
                points={points}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {series.points.map((point, index) => (
                <circle
                  key={point.period}
                  cx={xForIndex(index)}
                  cy={yForValue(point.value)}
                  r={point.highlighted ? 3.8 : 2.5}
                  fill="#FFFFFF"
                  stroke={color}
                  strokeWidth={point.highlighted ? 2.5 : 1.8}
                />
              ))}
            </g>
          );
        })}
        {chartData.categories.map((category, index) => {
          if (!visiblePeriodIndexes.has(index)) return null;
          const textAnchor =
            index === 0
              ? "start"
              : index === categoryCount - 1
                ? "end"
                : "middle";

          return (
            <text
              key={category.period}
              x={xForIndex(index)}
              y={PRINT_CHART_BOTTOM + 28}
              textAnchor={textAnchor}
              fontSize="14"
              fontWeight={category.highlighted ? 700 : 400}
              fill="#5F6670"
            >
              {category.period}
            </text>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] font-semibold text-[#292829]">
        {chartData.series.map((series) => (
          <span key={series.id} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: getVisibleChartColor(series.color) }}
            />
            {translateLabel(series.label)}
          </span>
        ))}
      </div>
    </div>
  );
}

function AnalysisSection({
  analysis,
  report,
  index,
  locale,
  mapSrc,
  mapActive,
  mapAttempt,
  mapQueuedAt,
  onMapCapture,
  docsContent,
}: {
  analysis: MunicipalReportAnalysis;
  report: MunicipalReportData;
  index: number;
  locale: string;
  mapSrc?: string;
  mapActive?: boolean;
  mapAttempt?: number;
  mapQueuedAt?: number | null;
  onMapCapture?: (src: string | null) => void;
  docsContent: MunicipalReportDocsContent | null;
}) {
  const t = useTranslations("MunicipalReport");
  const tModules = useTranslations("ModulesContext");
  const tCaption = useTranslations("PlatformMapCaption");
  const tHas = (key: string) => t.has(key);
  const tModulesHas = (key: string) => tModules.has(key);
  const tCaptionHas = (key: string) => tCaption.has(key);

  const translatedTitle = translateAnalysisTitle(
    analysis,
    t,
    tHas,
    tModules,
    tModulesHas,
  );
  const dominant = analysis.snapshot?.dominantClass;
  const presentation = getMunicipalReportPresentation(analysis.id);
  const situationText = buildSituationNarrative(
    analysis,
    docsContent,
    report,
    presentation,
    locale,
    (key, values) => t(key, values),
    (label) => translateClassLabel(label, t, tHas, tCaption, tCaptionHas),
    (title, id) =>
      translateAnalysisTitle(
        { ...analysis, title, id },
        t,
        tHas,
        tModules,
        tModulesHas,
      ),
    tHas,
  );
  const sectionColor = presentation.sectionColor;
  const effectivePeriod = analysis.effectivePeriod ?? analysis.snapshot?.period;
  const referencePeriod =
    effectivePeriod ?? analysis.snapshot?.period ?? analysis.requestedPeriod;
  const referencePeriodLabel = formatReportPeriod(referencePeriod, locale);
  const snapshotPeriodLabel = analysis.snapshot?.label || referencePeriodLabel;
  const periodResolution = `${t("analyzedPeriod")}: ${referencePeriodLabel}.`;
  const historyRange = compactPeriodRange(
    analysis.timeSeries,
    referencePeriod,
    locale,
    (key, values) => t(key, values),
  );
  const pdfChartHistoryRange = compactPeriodRange(
    selectMunicipalReportChartSnapshots(
      analysis.timeSeries,
      MUNICIPAL_REPORT_PDF_CHART_MAX_MEASUREMENTS,
    ),
    referencePeriod,
    locale,
    (key, values) => t(key, values),
  );
  const narrativeSections = buildAnalysisNarrativeSections(
    analysis,
    docsContent,
    locale,
  );
  const valueLabels = getMunicipalReportValueLabels(analysis, (key, values) =>
    t(key, values),
  );

  return (
    <section className="report-section">
      <h2
        className="px-5 py-2.5 text-xl font-bold text-white"
        style={{ backgroundColor: sectionColor }}
      >
        {index + 1}. {translatedTitle}
      </h2>

      {analysis.status !== "available" || !analysis.snapshot ? (
        <div className="report-analysis-summary report-block mt-7 border border-[#d9e0e3] p-5">
          <p className="font-bold text-[#536e7b]">
            {t(`status.${analysis.status}`)}
          </p>
          {analysis.timeSeries.length > 0 && (
            <p className="mt-2 text-sm leading-6 text-neutral-600">
              {t("availablePeriods")}:{" "}
              {analysis.timeSeries.map((item) => item.period).join(", ")}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="report-analysis-summary report-block mt-7 grid border border-[#d9e0e3] md:grid-cols-[1fr_226px]">
            <div className="p-5 text-[15px] leading-6 text-neutral-800">
              <p className="font-bold">
                {t("currentSituation")}{" "}
                <span className="font-normal text-[#536e7b]">
                  {report.municipality.name} — {report.municipality.uf}
                </span>
              </p>
              {situationText && (
                <p className="mt-2 whitespace-pre-line text-justify">
                  {situationText}
                </p>
              )}
              <dl className="mt-4 grid gap-2 border-t border-[#d9e0e3] pt-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-bold text-[#536e7b]">
                    {t("analyzedPeriod")}
                  </dt>
                  <dd>{referencePeriodLabel}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[#536e7b]">
                    {t("availableSeries")}
                  </dt>
                  <dd>{historyRange}</dd>
                </div>
              </dl>
            </div>
            {dominant && (
              <div
                className="flex min-h-40 flex-col items-center justify-center px-5 py-7 text-center text-white"
                style={{
                  backgroundColor: dominant.color || sectionColor,
                  color: textColorForBackground(dominant.color || sectionColor),
                }}
              >
                <strong className="text-lg">
                  {translateClassLabel(
                    dominant.label,
                    t,
                    tHas,
                    tCaption,
                    tCaptionHas,
                  )}
                </strong>
                <span className="mt-1 text-3xl font-bold">
                  {formatMunicipalReportValue(
                    dominant.percentage,
                    analysis,
                    locale,
                  )}
                </span>
                <span className="mt-2 text-xs">{valueLabels.cardContext}</span>
              </div>
            )}
          </div>

          <h3 className="report-data-heading report-heading mt-8 text-lg font-bold text-[#536e7b]">
            {t("sectionTitleOf", {
              sectionTitle: valueLabels.sectionTitle,
              title: translatedTitle,
            })}
          </h3>
          <div className="report-data-table report-block mt-3 overflow-hidden border border-[#c8ced1]">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#176b39] text-white">
                <tr>
                  <th className="border-r border-white/40 px-4 py-2.5 text-left">
                    {t("tableClass")}
                  </th>
                  <th className="w-36 px-4 py-2.5 text-right">
                    {valueLabels.tableValue}
                  </th>
                </tr>
              </thead>
              <tbody>
                {analysis.snapshot.distribution.map((item) => {
                  const visibleColor = getVisibleChartColor(item.color);
                  const rowBackground = `${visibleColor}33`;
                  const rowHoverBackground = `${visibleColor}4d`;

                  return (
                    <tr
                      key={item.id}
                      className="report-data-row border-t border-[#c8ced1]"
                      style={
                        {
                          "--report-row-bg": rowBackground,
                          "--report-row-hover-bg": rowHoverBackground,
                        } as CSSProperties
                      }
                    >
                      <td
                        className="border-r border-[#c8ced1] px-4 py-2.5 font-medium"
                        style={{ backgroundColor: rowBackground }}
                      >
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-full border border-black/10"
                          style={{ backgroundColor: visibleColor }}
                        />
                        {translateClassLabel(
                          item.label,
                          t,
                          tHas,
                          tCaption,
                          tCaptionHas,
                        )}
                      </td>
                      <td
                        className="px-4 py-2.5 text-right font-semibold"
                        style={{ backgroundColor: rowBackground }}
                      >
                        {formatMunicipalReportValue(
                          item.percentage,
                          analysis,
                          locale,
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="report-visual-block mt-8">
            <h3 className="report-heading text-lg font-bold text-[#536e7b]">
              {t("spatialAndTimeSeries")}
            </h3>
            <div className="report-visual-grid mt-3 grid overflow-hidden border border-[#c8ced1] bg-[#fbfcfd] md:grid-cols-2">
              <div className="report-visual-panel flex flex-col border-b border-[#c8ced1] md:border-b-0 md:border-r">
                <div className="report-visual-title border-b border-[#c8ced1] bg-[#f8fafb] px-4 py-2.5 text-center text-sm font-semibold text-[#536e7b]">
                  {t("spatialImage", { period: snapshotPeriodLabel })}
                </div>
                <ReportMapPreview
                  municipalityCode={report.municipality.code}
                  layerId={analysis.id}
                  period={referencePeriod}
                  className="report-map-frame h-[230px] w-full"
                  active={mapActive}
                  attempt={mapAttempt}
                  imageSrc={mapSrc}
                  queuedAt={mapQueuedAt}
                  onCapture={onMapCapture}
                />
                <p className="border-t border-[#c8ced1] px-4 py-2 text-xs leading-5 text-neutral-600">
                  {t("rasterDescription", {
                    title: translatedTitle,
                    period: referencePeriodLabel,
                    municipality: report.municipality.name,
                    uf: report.municipality.uf,
                  })}
                </p>
              </div>
              <div className="report-visual-panel flex flex-col">
                <div className="report-visual-title report-chart-screen border-b border-[#c8ced1] bg-[#f8fafb] px-4 py-2.5 text-center text-sm font-semibold text-[#536e7b]">
                  {valueLabels.chartSeries}: {historyRange}
                </div>
                <div className="report-visual-title report-chart-print hidden border-b border-[#c8ced1] bg-[#f8fafb] px-4 py-2.5 text-center text-sm font-semibold text-[#536e7b]">
                  {valueLabels.chartSeries}: {pdfChartHistoryRange}
                </div>
                <div className="report-chart-frame report-chart-screen flex min-h-[260px] flex-1 items-center justify-center bg-[#fbfcfd] p-3">
                  <MunicipalReportDynamicChart
                    analysis={analysis}
                    locale={locale}
                    referencePeriod={referencePeriod}
                    translateLabel={(label) =>
                      translateClassLabel(label, t, tHas, tCaption, tCaptionHas)
                    }
                  />
                </div>
                <div className="report-chart-frame report-chart-print hidden items-center justify-center bg-[#fbfcfd] p-3">
                  <MunicipalReportPrintChart
                    analysis={analysis}
                    locale={locale}
                    referencePeriod={referencePeriod}
                    translateLabel={(label) =>
                      translateClassLabel(label, t, tHas, tCaption, tCaptionHas)
                    }
                  />
                </div>
                <p className="border-t border-[#c8ced1] px-4 py-2 text-xs leading-5 text-neutral-600">
                  {periodResolution}
                </p>
              </div>
            </div>
          </div>

          {narrativeSections.length > 0 ? (
            <div className="report-narrative report-block mt-7 border border-[#d9e0e3] p-5 text-[15px] leading-6">
              <h3 className="report-heading font-bold text-[#536e7b]">
                {t("historicalAnalysisTitle")}
              </h3>
              {narrativeSections.map((section, sectionIndex) => (
                <p
                  key={`${section.title}:${sectionIndex}`}
                  className="mt-3 whitespace-pre-line text-justify text-neutral-800"
                >
                  <strong>{section.title}:</strong> {section.text}
                </p>
              ))}
              <p className="mt-3 text-justify text-neutral-800">
                <strong>{t("sectionReferenceLabel")}</strong> {periodResolution}
              </p>
            </div>
          ) : (
            <div className="report-narrative report-block mt-7 border border-[#d9e0e3] p-5 text-[15px] leading-6">
              <h3 className="report-heading font-bold text-[#536e7b]">
                {t("historicalNoteTitle")}
              </h3>
              <p className="mt-1 text-justify text-neutral-800">
                {t("historicalNoteText", {
                  count: String(analysis.timeSeries.length),
                  range: historyRange,
                  resolution: periodResolution,
                })}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const ReportDocument = memo(function ReportDocument({
  report,
  layerIds = [],
  mapImages,
  activeMapKeys,
  mapQueueStartedAt,
  retryAttemptFor,
  onMapCapture,
  documentRef,
  docsContent,
}: {
  report: MunicipalReportData;
  layerIds?: string[];
  mapImages: Map<string, string | null>;
  activeMapKeys: ReadonlySet<string>;
  mapQueueStartedAt: number | null;
  retryAttemptFor: (key: string) => number;
  onMapCapture?: (key: string, src: string | null) => void;
  documentRef?: Ref<HTMLElement>;
  docsContent: MunicipalReportDocsContent | null;
}) {
  const t = useTranslations("MunicipalReport");
  const tModules = useTranslations("ModulesContext");
  const tHas = (key: string) => t.has(key);
  const tModulesHas = (key: string) => tModules.has(key);
  const locale = useLocale();
  const generatedAt = new Date(report.generatedAt).toLocaleDateString(locale);
  const selected = layerIds.length
    ? report.analyses.filter(({ id }) => layerIds.includes(id))
    : report.analyses;
  const availableTitles = selected
    .map((analysis) =>
      translateAnalysisTitle(analysis, t, tHas, tModules, tModulesHas),
    )
    .join(" · ");
  const availableAnalyses = selected.filter(
    (analysis) => analysis.status === "available" && analysis.snapshot,
  );
  const effectivePeriodSummary = availableAnalyses
    .map(
      (analysis) =>
        analysis.effectivePeriod ??
        analysis.snapshot?.period ??
        report.requestedPeriod,
    )
    .filter((period, index, periods) => periods.indexOf(period) === index)
    .map((period) => formatReportPeriod(period, locale))
    .join(" · ");
  const reportText = (section: string, fallback: string) =>
    getReportDocsText(docsContent, section, locale) ?? fallback;

  return (
    <article
      ref={documentRef}
      className="report-paper report-paper-html min-h-full bg-white text-[#202020]"
    >
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4 text-xs text-[#0f5a2d]">
          <strong>
            {reportText(
              "Identificação do sistema",
              t("document.systemIdentification"),
            )}
          </strong>
          <span className="text-[#536e7b]">
            {reportText("Tipo do relatório", t("document.reportType"))}
          </span>
          <div className="text-right">
            <strong>
              {reportText("Instituições", t("document.institutions"))}
            </strong>
            <div className="mt-1 text-[10px] font-normal text-[#536e7b]">
              {reportText("Site", t("document.website"))}
            </div>
          </div>
        </div>

        <div className="mt-6 bg-[#125c2d] px-6 py-3 text-center text-white">
          <h1 className="text-[22px] font-bold uppercase leading-tight">
            {reportText("Título principal", t("document.mainTitle"))}
          </h1>
          <p className="mt-2 text-sm text-white/80">
            {reportText("Subtítulo", t("document.subtitle"))}
          </p>
        </div>

        <div className="report-block mt-6 border border-[#c8ced1] text-sm">
          <div className="grid grid-cols-[175px_1fr] border-b border-[#c8ced1] sm:grid-cols-[175px_1fr_105px_115px]">
            <strong className="bg-[#f1f2f2] px-3 py-2.5 text-[#536e7b]">
              {reportText(
                "Rótulo área de análise",
                t("document.analysisAreaLabel"),
              )}
            </strong>
            <span className="border-l border-[#c8ced1] px-3 py-2.5 font-bold">
              {report.municipality.name} — {report.municipality.uf}
            </span>
            <strong className="border-l border-[#c8ced1] bg-[#f1f2f2] px-3 py-2.5 text-center text-[#536e7b]">
              {reportText("Rótulo escala", t("document.scaleLabel"))}
            </strong>
            <span className="border-l border-[#c8ced1] px-3 py-2.5 text-center">
              {t("document.scaleValue")}
            </span>
          </div>
          <div className="grid grid-cols-[175px_1fr] sm:grid-cols-[175px_1fr_105px_115px]">
            <strong className="bg-[#f1f2f2] px-3 py-2.5 text-[#536e7b]">
              {reportText(
                "Rótulo data de geração",
                t("document.generationDateLabel"),
              )}
            </strong>
            <span className="border-l border-[#c8ced1] px-3 py-2.5">
              {generatedAt}
            </span>
            <strong className="border-l border-[#c8ced1] bg-[#f1f2f2] px-3 py-2.5 text-center text-[#536e7b]">
              {reportText("Rótulo referência", t("document.referenceLabel"))}
            </strong>
            <span className="border-l border-[#c8ced1] px-3 py-2.5 text-center">
              {formatReportPeriod(report.requestedPeriod, locale)}
            </span>
          </div>
        </div>

        <div className="report-block mt-5 grid border border-[#c8ced1] text-sm sm:grid-cols-[175px_1fr]">
          <strong className="bg-[#f1f2f2] px-3 py-2.5 text-[#536e7b]">
            {reportText(
              "Rótulo variáveis selecionadas",
              t("document.selectedVariablesLabel"),
            )}
          </strong>
          <span className="border-l border-[#c8ced1] px-3 py-2.5">
            {availableTitles}
          </span>
        </div>
        {effectivePeriodSummary && (
          <div className="report-block mt-3 grid border border-[#c8ced1] text-sm sm:grid-cols-[175px_1fr]">
            <strong className="bg-[#f1f2f2] px-3 py-2.5 text-[#536e7b]">
              {reportText(
                "Rótulo períodos analisados",
                t("document.analyzedPeriodsLabel"),
              )}
            </strong>
            <span className="border-l border-[#c8ced1] px-3 py-2.5">
              {effectivePeriodSummary}
            </span>
          </div>
        )}
      </header>

      <div className="report-sections mt-10 space-y-12">
        {selected.map((analysis, index) => {
          const mapKey = `${analysis.id}:${analysis.effectivePeriod ?? analysis.snapshot?.period ?? report.requestedPeriod}`;
          return (
            <AnalysisSection
              key={analysis.id}
              analysis={analysis}
              report={report}
              index={index}
              locale={locale}
              mapSrc={mapImages.get(mapKey) ?? undefined}
              mapActive={activeMapKeys.has(mapKey)}
              mapAttempt={retryAttemptFor(mapKey)}
              mapQueuedAt={mapQueueStartedAt}
              onMapCapture={(src) => onMapCapture?.(mapKey, src)}
              docsContent={docsContent}
            />
          );
        })}
      </div>

      <section className="report-notes mt-12 border-t border-[#d9e0e3] pt-8">
        <h2 className="report-heading text-xl font-bold text-[#536e7b]">
          {reportText("Título das notas", t("document.notesTitle"))}
        </h2>
        <div className="mt-5 space-y-2 text-sm leading-5 text-neutral-800">
          {selected.map((analysis) => {
            const presentation = getMunicipalReportPresentation(analysis.id);
            const title = translateAnalysisTitle(
              analysis,
              t,
              tHas,
              tModules,
              tModulesHas,
            );
            const methodology = translateAnalysisMethodology(
              analysis,
              docsContent,
              presentation.methodology,
              t,
              tHas,
              tModules,
              tModulesHas,
              locale,
            );
            return (
              <p key={analysis.id} className="whitespace-pre-line">
                <strong>{title}:</strong> {methodology}
              </p>
            );
          })}
          <p className="whitespace-pre-line">
            <strong>{t("document.legalReferenceLabel")}:</strong>{" "}
            {reportText("Referência legal", t("document.legalReferenceValue"))}
          </p>
        </div>
        <p className="mt-8 text-sm leading-5 text-[#536e7b]">
          {reportText("Aviso automático", t("document.automatedNotice"))}
        </p>
      </section>

      <footer className="mt-16 border-t border-[#d9e0e3] pt-3 text-[11px] text-[#536e7b]">
        {reportText("Rodapé", t("document.footer", { generatedAt }))}
      </footer>
    </article>
  );
});

function EmptyReportPreview() {
  const t = useTranslations("MunicipalReport");

  return (
    <div className="flex h-full min-h-[620px] flex-col items-center justify-center gap-6 px-8 py-12 text-center">
      <svg
        className="h-auto w-full max-w-[488px]"
        viewBox="0 0 488 488"
        fill="none"
        aria-hidden="true"
      >
        <use href="/sprite.svg#municipal-report-empty-illustration" />
      </svg>
      <div className="flex w-full max-w-[602px] items-center justify-center rounded-2xl bg-[#E1E2B4] p-9">
        <p className="font-open-sans text-2xl font-bold leading-[1.5] text-[#777E32]">
          {t("emptyPreviewInstruction")}
        </p>
      </div>
    </div>
  );
}

export function MunicipalReportPreview({
  municipalityCode,
  period,
  layerIds,
  embedded = false,
}: MunicipalReportPreviewProps) {
  const t = useTranslations("MunicipalReport");
  const locale = useLocale();
  const hasRequiredParameters = Boolean(municipalityCode && period);
  const [report, setReport] = useState<MunicipalReportData | null>(null);
  const [docsContent, setDocsContent] =
    useState<MunicipalReportDocsContent | null>(null);
  const [mapQueueStartedAt, setMapQueueStartedAt] = useState<number | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(hasRequiredParameters);
  const [exporting, setExporting] = useState(false);
  const [zoom, setZoom] = useState(100);
  const reportDocumentRef = useRef<HTMLElement>(null);
  const navigationMeasuredRef = useRef(false);
  const previewMeasuredRef = useRef(false);
  const summaryMeasuredRef = useRef(false);
  const mapQueueMeasuredRef = useRef(false);
  const mapQueuePeakConcurrencyRef = useRef(0);
  const layerIdsKey = useMemo(() => layerIds?.join(",") ?? "", [layerIds]);
  const reportMapKeys = useMemo(() => {
    if (!report) return [];
    const selectedLayerIds = layerIdsKey
      ? new Set(layerIdsKey.split(","))
      : null;
    return (
      selectedLayerIds
        ? report.analyses.filter(({ id }) => selectedLayerIds.has(id))
        : report.analyses
    )
      .filter(
        (analysis) => analysis.status === "available" && analysis.snapshot,
      )
      .map(
        (analysis) =>
          `${analysis.id}:${analysis.effectivePeriod ?? analysis.snapshot?.period ?? report.requestedPeriod}`,
      );
  }, [layerIdsKey, report]);
  const loadErrorMessage = t("loadError");
  const {
    activeMapKeys,
    handleMapCapture,
    mapImages,
    mapsReady,
    resetMapCaptureQueue,
    retryAttemptFor,
  } = useReportMapCaptureQueue(reportMapKeys);

  useEffect(() => {
    if (!hasRequiredParameters || navigationMeasuredRef.current) return;
    navigationMeasuredRef.current = true;
    recordMunicipalReportNavigation();
  }, [hasRequiredParameters]);

  useEffect(() => {
    if (!report || loading || previewMeasuredRef.current) return;
    previewMeasuredRef.current = true;
    const finishRender = startMunicipalReportStage();
    const frame = window.requestAnimationFrame(() => {
      finishRender("Renderização da prévia", {
        detalhes: `${report.analyses.length} análise(s) no documento`,
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, report]);

  useEffect(() => {
    mapQueueMeasuredRef.current = false;
    mapQueuePeakConcurrencyRef.current = 0;
  }, [mapQueueStartedAt]);

  useEffect(() => {
    mapQueuePeakConcurrencyRef.current = Math.max(
      mapQueuePeakConcurrencyRef.current,
      activeMapKeys.size,
    );
  }, [activeMapKeys, mapQueueStartedAt]);

  useEffect(() => {
    if (
      !report ||
      loading ||
      !mapsReady ||
      mapQueueStartedAt === null ||
      mapQueueMeasuredRef.current
    )
      return;
    mapQueueMeasuredRef.current = true;
    const finishQueue = startMunicipalReportStage(mapQueueStartedAt);
    finishQueue("Fila de imagens espaciais", {
      detalhes: `${reportMapKeys.length} mapa(s); concorrência máxima ${mapQueuePeakConcurrencyRef.current}`,
    });
  }, [loading, mapQueueStartedAt, mapsReady, report, reportMapKeys.length]);

  useEffect(() => {
    if (!report || loading || !mapsReady || summaryMeasuredRef.current) return;
    summaryMeasuredRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      finishMunicipalReportMetrics(
        `${reportMapKeys.length} mapa(s) capturado(s); visualização HTML pronta.`,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loading, mapsReady, report, reportMapKeys.length]);

  function printReport() {
    if (!reportDocumentRef.current || exporting || !mapsReady) return;

    setExporting(true);
    setError(null);
    const printWindow = window.open("", "_blank", "popup,width=980,height=800");
    if (!printWindow) {
      setExporting(false);
      setError(t("popupBlocked"));
      return;
    }

    const styles = [
      ...document.querySelectorAll('link[rel="stylesheet"], style'),
    ]
      .map((element) => element.outerHTML)
      .join("\n");
    const baseUrl = `${window.location.origin}/`;
    const filename = buildReportFilename(
      report,
      period,
      t("reportLabel"),
      t("reportFilenamePrefix"),
    );
    const printOverrides = `
      <style>
        @page{size:A4;margin:14mm 15mm}
        html,body{width:auto;margin:0;background:#fff}
        body{-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .report-paper{box-sizing:border-box;width:auto!important;min-height:auto!important;margin:0!important;padding:0!important;overflow:visible;box-shadow:none!important}
        .report-sections{margin-top:8mm!important}
        .report-section+.report-section{margin-top:8mm!important}
        .report-analysis-summary{margin-top:5mm!important}
        .report-data-heading{margin-top:5mm!important}
        .report-data-table{margin-top:3mm!important}
        .report-visual-block,.report-narrative{margin-top:5mm!important}
        .report-notes{margin-top:8mm!important;padding-top:5mm!important}
        .report-paper footer{margin-top:6mm!important}
        .report-visual-grid{display:grid;grid-template-columns:minmax(0,.84fr) minmax(0,1.16fr)}
        .report-visual-panel{min-width:0}
        .report-visual-panel:first-child{border-right:1px solid #c8ced1;border-bottom:0}
        .report-map-frame{height:230px}
        .report-chart-frame{min-height:230px}
        .report-chart-print{display:none!important}
        @media print{
          .report-visual-grid{display:grid!important;grid-template-columns:minmax(0,.84fr) minmax(0,1.16fr)!important}
          .report-visual-panel{display:flex!important;flex-direction:column!important;min-width:0}
          .report-visual-title{box-sizing:border-box;display:flex!important;min-height:16mm;align-items:center;justify-content:center}
          .report-map-frame{height:230px!important}
          .report-chart-frame{min-height:230px!important}
          .report-chart-screen{display:none!important}
          .report-chart-print{display:block!important}
          .report-visual-title.report-chart-print{display:flex!important}
          .report-chart-frame.report-chart-print{display:flex!important;min-height:0!important;overflow:visible!important}
          .report-print-chart-svg{display:block;width:100%!important;height:auto!important;overflow:visible!important}
          .report-map-frame img{object-fit:contain!important;object-position:center!important}
          .report-paper img{break-inside:avoid;page-break-inside:avoid}
          .report-paper table{break-inside:auto;page-break-inside:auto}
          .report-paper tr,.report-block,.report-visual-panel{break-inside:avoid;page-break-inside:avoid}
          .report-narrative{break-inside:auto!important;page-break-inside:auto!important}
          .report-heading{break-after:avoid;page-break-after:avoid}
          .report-section{break-inside:auto;page-break-inside:auto}
          .report-visual-block{break-inside:avoid;page-break-inside:avoid}
          .report-notes{break-inside:auto;page-break-inside:auto}
          .report-paper p,.report-notes p{orphans:3;widows:3}
        }
      </style>`;

    printWindow.document.open();
    printWindow.document.write(
      `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><base href="${baseUrl}"><title></title>${styles}${printOverrides}</head><body>${reportDocumentRef.current.outerHTML}</body></html>`,
    );
    printWindow.document.close();
    printWindow.document.title = filename;

    const finish = () => {
      printWindow.focus();
      printWindow.print();
      setExporting(false);
    };
    printWindow.addEventListener("afterprint", () => printWindow.close(), {
      once: true,
    });
    if (printWindow.document.readyState === "complete") {
      window.setTimeout(finish, 300);
    } else {
      printWindow.addEventListener(
        "load",
        () => window.setTimeout(finish, 300),
        { once: true },
      );
    }
  }

  useEffect(() => {
    if (!hasRequiredParameters) return;
    const controller = new AbortController();

    async function loadReport() {
      let reportLoaded = false;
      previewMeasuredRef.current = false;
      summaryMeasuredRef.current = false;
      resetMapCaptureQueue();
      setMapQueueStartedAt(null);
      setLoading(true);
      setError(null);
      try {
        const finishBaseReport = startMunicipalReportStage();
        const reportParams = new URLSearchParams({ period });
        if (layerIdsKey) reportParams.set("layers", layerIdsKey);
        const response = await fetch(
          `/api/municipal-report/${encodeURIComponent(municipalityCode)}?${reportParams.toString()}`,
          { credentials: "same-origin", signal: controller.signal },
        );
        const payload = await response.json();
        finishBaseReport("Relatório-base", {
          response,
          detalhes: `${layerIdsKey ? layerIdsKey.split(",").length : "todas"} camada(s) solicitada(s)`,
        });
        if (!response.ok) throw new Error(payload.error ?? loadErrorMessage);
        reportLoaded = true;
        setReport(payload as MunicipalReportData);
        setDocsContent(null);

        const reportData = payload as MunicipalReportData;
        const selectedLayerIds = layerIdsKey
          ? new Set(layerIdsKey.split(","))
          : null;
        const selectedLayerIdsForDocs = (
          selectedLayerIds
            ? reportData.analyses.filter(({ id }) => selectedLayerIds.has(id))
            : reportData.analyses
        )
          .filter((analysis) => analysis.status === "available")
          .map((analysis) => analysis.id);

        const docsTask = async () => {
          if (selectedLayerIdsForDocs.length === 0) return;
          const finishDocs = startMunicipalReportStage();
          let docsResponse: Response | undefined;
          try {
            docsResponse = await fetch(
              `/api/municipal-report/${encodeURIComponent(municipalityCode)}/docs?period=${encodeURIComponent(period)}&layers=${encodeURIComponent(selectedLayerIdsForDocs.join(","))}`,
              { credentials: "same-origin", signal: controller.signal },
            );
            const docsPayload = await docsResponse.json();
            finishDocs("Textos do Google Docs", {
              response: docsResponse,
              detalhes: `${selectedLayerIdsForDocs.length} tema(s)`,
            });
            if (!docsResponse.ok)
              throw new Error(docsPayload.error ?? loadErrorMessage);
            setDocsContent(docsPayload.content as MunicipalReportDocsContent);
          } catch (docsError) {
            if (!docsResponse) {
              finishDocs("Textos do Google Docs", {
                detalhes: "Falha antes de receber a resposta",
              });
            }
            if (controller.signal.aborted) throw docsError;
            console.warn(
              "Não foi possível carregar os textos do relatório; mantendo os dados e gráficos disponíveis.",
              docsError,
            );
            setDocsContent(null);
          }
        };

        await docsTask();
      } catch (reason) {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setError(reason instanceof Error ? reason.message : loadErrorMessage);
      } finally {
        if (!controller.signal.aborted) {
          if (reportLoaded) setMapQueueStartedAt(performance.now());
          setLoading(false);
        }
      }
    }

    loadReport();
    return () => controller.abort();
  }, [
    hasRequiredParameters,
    layerIdsKey,
    loadErrorMessage,
    municipalityCode,
    period,
    resetMapCaptureQueue,
  ]);

  const visibleError = hasRequiredParameters ? error : null;

  if (embedded) {
    const previewTitle = report
      ? `${t("reportLabel")} - ${report.municipality.name} - ${formatReportPeriod(period, locale)}`
      : t("reportLabel");

    return (
      <div className="flex h-full min-w-0 flex-col bg-white">
        <div className="shrink-0 border-b border-[#D9E0E3] bg-white px-4 py-4 sm:px-6">
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="font-inter text-xs font-semibold uppercase tracking-[0.08em] text-[#536E7B]">
                {t("preview")}
              </p>
              <h1 className="mt-1 truncate font-inter text-base font-semibold text-[#292829]">
                {previewTitle}
              </h1>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-3">
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setZoom((value) => Math.max(50, value - 10))}
                  disabled={!report || zoom <= 50}
                  className="flex h-10 w-10 items-center justify-center rounded border border-[#D9E0E3] bg-white text-[#989F43] transition hover:bg-[#F6F7F6] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={t("zoomOut")}
                >
                  <svg
                    className="h-6 w-6"
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M8 11h6M20 20l-3.5-3.5" />
                  </svg>
                </button>
                <output
                  className="flex h-10 w-[60px] items-center justify-center rounded-md border border-[#DCDBDC] bg-white px-2 font-inter text-sm text-[#7E797B]"
                  aria-live="polite"
                >
                  {zoom}%
                </output>
                <button
                  type="button"
                  onClick={() => setZoom((value) => Math.min(150, value + 10))}
                  disabled={!report || zoom >= 150}
                  className="flex h-10 w-10 items-center justify-center rounded border border-[#D9E0E3] bg-white text-[#989F43] transition hover:bg-[#F6F7F6] disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={t("zoomIn")}
                >
                  <svg
                    className="h-6 w-6"
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="M11 8v6M8 11h6M20 20l-3.5-3.5" />
                  </svg>
                </button>
              </div>
              <button
                type="button"
                disabled={!report || exporting || !mapsReady}
                onClick={printReport}
                className="flex h-10 shrink-0 items-center justify-center gap-2 rounded bg-[#989F43] px-4 font-inter text-sm font-medium text-white transition hover:bg-[#818836] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {exporting ? (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
                  />
                ) : (
                  <svg
                    className="h-4 w-4"
                    aria-hidden
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M12 3v12m0 0 4-4m-4 4-4-4" />
                    <path d="M5 20h14" />
                  </svg>
                )}
                {exporting || (report && !mapsReady)
                  ? t("preparingDownload")
                  : t("downloadPdf")}
              </button>
            </div>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto bg-white">
          {!hasRequiredParameters && <EmptyReportPreview />}
          {loading && (
            <div className="mx-auto flex min-h-56 max-w-[749px] flex-col items-center justify-center gap-4 bg-white p-10 text-center text-neutral-600 shadow-sm">
              <span
                aria-hidden="true"
                className="h-9 w-9 animate-spin rounded-full border-4 border-[#989F43]/25 border-t-[#989F43]"
              />
              <strong className="text-base font-semibold text-[#536e7b]">
                {t("loading")}
              </strong>
              <span className="text-sm">{t("loadingHint")}</span>
            </div>
          )}
          {visibleError && !loading && (
            <div className="mx-auto max-w-[749px] border border-red-200 bg-white p-8 shadow-sm">
              <h1 className="text-xl font-semibold">{t("loadError")}</h1>
              <p className="mt-2 text-sm text-red-700">{visibleError}</p>
            </div>
          )}
          {report && !loading && (
            <div
              className="mx-auto origin-top-left will-change-transform"
              style={{ width: "100%", transform: `scale(${zoom / 100})` }}
            >
              <ReportDocument
                report={report}
                layerIds={layerIds}
                mapImages={mapImages}
                activeMapKeys={activeMapKeys}
                mapQueueStartedAt={mapQueueStartedAt}
                retryAttemptFor={retryAttemptFor}
                onMapCapture={handleMapCapture}
                documentRef={reportDocumentRef}
                docsContent={docsContent}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#e9ece9] px-4 py-8 sm:px-8 print:bg-white print:p-0">
      <div className="mx-auto max-w-[980px]">
        <Link
          href={`/${locale}/platform?section=communication`}
          className="text-sm font-semibold text-[#526426] hover:underline print:hidden"
        >
          ← {t("back")}
        </Link>
        {loading && (
          <div className="mt-6 bg-white p-10 text-center text-neutral-600 shadow-sm">
            {t("loading")}
          </div>
        )}
        {visibleError && !loading && (
          <div className="mt-6 border border-red-200 bg-white p-8 shadow-sm">
            <h1 className="text-xl font-semibold">{t("loadError")}</h1>
            <p className="mt-2 text-sm text-red-700">{visibleError}</p>
          </div>
        )}
        {report && !loading && (
          <ReportDocument
            report={report}
            layerIds={layerIds}
            mapImages={mapImages}
            activeMapKeys={activeMapKeys}
            mapQueueStartedAt={mapQueueStartedAt}
            retryAttemptFor={retryAttemptFor}
            onMapCapture={handleMapCapture}
            docsContent={docsContent}
          />
        )}
      </div>
    </div>
  );
}
