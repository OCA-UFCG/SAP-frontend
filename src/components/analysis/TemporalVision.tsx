"use client";

import {
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { useTranslations } from "next-intl";
import type {
  CompactAnalysisClass,
  CompactAnalysisYearData,
} from "@/utils/analysis";
import { parseDekadPeriod } from "@/utils/dekadPeriod";

interface TemporalVisionProps {
  years?: Record<string, CompactAnalysisYearData>;
  classes?: CompactAnalysisClass[];
  selectedState?: string;
  valueType?: "percentage" | "absolute";
  valueUnit?: string;
}

const MAX_VISIBLE_YEARS = 8;
// Uma série decendial abre no último ano: 8 decêndios seriam pouco mais de dois
// meses, e a alça da barra ficaria minúscula diante dos 926 do CDI.
const MAX_VISIBLE_DEKADS = 36;
// No eixo de datas, a mesma data ISO das chaves, cortada no nível que cabe: o
// ano com a série toda aberta, o mês num zoom de um ano, o dia mais perto.
const DEKAD_AXIS_DATE_FORMATS = {
  day: "yyyy-MM-dd",
  week: "yyyy-MM-dd",
  month: "yyyy-MM",
  year: "yyyy",
};
// Sem o passo de 10 anos, a série inteira do CDI marca 2005, 2010, 2015...
// em vez de só 2010 e 2020.
const DEKAD_AXIS_GRID_INTERVALS: am5.time.ITimeInterval[] = [
  { timeUnit: "day", count: 1 },
  { timeUnit: "day", count: 10 },
  { timeUnit: "month", count: 1 },
  { timeUnit: "month", count: 3 },
  { timeUnit: "month", count: 6 },
  { timeUnit: "year", count: 1 },
  { timeUnit: "year", count: 2 },
  { timeUnit: "year", count: 5 },
];

function isTestEnvironment() {
  return (
    (typeof process !== "undefined" && process.env.NODE_ENV === "test") ||
    (typeof process !== "undefined" && process.env.VITEST) ||
    (typeof window !== "undefined" &&
      window.navigator &&
      window.navigator.userAgent.includes("jsdom"))
  );
}

function sortYearEntries(years: Record<string, CompactAnalysisYearData>) {
  return Object.entries(years).sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

function buildYearCategories(
  sortedYearEntries: Array<[string, CompactAnalysisYearData]>,
) {
  return sortedYearEntries.map(([yearKey, yearData]) => ({
    year: yearData.year ?? yearKey,
  }));
}

function dekadTimestamp(period: string) {
  const parsed = parseDekadPeriod(period);
  return parsed
    ? Date.UTC(parsed.year, parsed.month - 1, (parsed.dekad - 1) * 10 + 1)
    : null;
}

export function buildSeriesData(
  sortedYearEntries: Array<[string, CompactAnalysisYearData]>,
  selectedState: string,
  classIndex: number,
) {
  return sortedYearEntries.map(([yearKey, yearData]) => {
    const locationValues = yearData.values[selectedState];
    const scale = yearData.valuesScale ?? 1;
    const rawValue = locationValues?.[classIndex];

    return {
      year: yearData.year ?? yearKey,
      value:
        typeof rawValue === "number"
          ? Number((rawValue / scale).toFixed(1))
          : null,
    };
  });
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const chartRef = useRef<am5xy.XYChart | null>(null);
  const xAxisRef = useRef<am5xy.Axis<am5xy.AxisRenderer> | null>(null);
  const legendRef = useRef<am5.Legend | null>(null);
  const seriesRef = useRef(new Map<string, am5xy.LineSeries>());
  const deferredSelectedState = useDeferredValue(selectedState);
  // Centenas de decêndios não cabem como categorias: as datas inteiras se
  // atropelam. A série decendial vai num eixo de datas, que escolhe sozinho
  // entre mostrar anos ou meses conforme o zoom.
  const isDekadSeries = useMemo(
    () => Object.keys(years ?? {}).some((key) => parseDekadPeriod(key)),
    [years],
  );

  useLayoutEffect(() => {
    if (isTestEnvironment() || !containerRef.current || rootRef.current) {
      return;
    }

    const root = am5.Root.new(containerRef.current);
    root.utc = true;
    const theme = am5.Theme.new(root);

    theme.rule("AxisLabel", ["minor"]).setAll({ dy: 1 });
    theme.rule("Grid", ["x"]).setAll({ strokeOpacity: 0.05 });
    theme.rule("Grid", ["x", "minor"]).setAll({ strokeOpacity: 0.05 });

    root.setThemes([am5themes_Animated.new(root), theme]);

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: true,
        panY: false,
        wheelX: "panX",
        wheelY: "none",
        pinchZoomX: true,
        layout: root.verticalLayout,
      }),
    );

    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 60,
    });
    xRenderer.labels.template.setAll({ paddingTop: 12 });

    const xAxis = chart.xAxes.push(
      isDekadSeries
        ? am5xy.DateAxis.new(root, {
            baseInterval: { timeUnit: "day", count: 1 },
            gridIntervals: DEKAD_AXIS_GRID_INTERVALS,
            dateFormats: DEKAD_AXIS_DATE_FORMATS,
            periodChangeDateFormats: DEKAD_AXIS_DATE_FORMATS,
            tooltipDateFormat: "yyyy-MM-dd",
            renderer: xRenderer,
            tooltip: am5.Tooltip.new(root, {}),
          })
        : am5xy.CategoryAxis.new(root, {
            categoryField: "year",
            renderer: xRenderer,
            tooltip: am5.Tooltip.new(root, {}),
          }),
    );

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        ...(valueType === "percentage" ? { max: 100, strictMinMax: true } : {}),
        renderer: am5xy.AxisRendererY.new(root, {}),
      }),
    );

    yAxis
      .get("renderer")
      .labels.template.adapters.add("text", (text, target) => {
        const value = target.dataItem?.get("value" as never) as
          number | undefined;

        if (value === undefined) {
          return text;
        }

        if (valueType === "absolute") {
          return text;
        }

        return value % 20 === 0 ? `${value}%` : "";
      });

    yAxis
      .get("renderer")
      .grid.template.adapters.add("strokeOpacity", (_opacity, target) => {
        const value = target.dataItem?.get("value" as never) as
          number | undefined;

        if (value === undefined) {
          return 0;
        }

        return valueType === "absolute" || value % 20 === 0 ? 0.15 : 0;
      });

    chart.set(
      "scrollbarX",
      am5xy.XYChartScrollbar.new(root, {
        orientation: "horizontal",
        height: 30,
      }),
    );

    const cursor = chart.set(
      "cursor",
      am5xy.XYCursor.new(root, {
        behavior: "none",
      }),
    );
    cursor.lineY.set("visible", false);

    const legend = chart.children.push(
      am5.Legend.new(root, {
        x: am5.percent(0),
        centerX: am5.percent(0),
        paddingTop: 15,
        width: am5.percent(100),
        layout: am5.GridLayout.new(root, {
          maxColumns: 2,
          fixedWidthGrid: false,
        }),
      }),
    );

    legend.itemContainers.template.events.on("pointerover", (event) => {
      const itemContainer = event.target;
      if (!itemContainer.dataItem) {
        return;
      }

      const hoveredSeries = itemContainer.dataItem.dataContext;
      chart.series.each((chartSeries) => {
        const lineSeries = chartSeries as am5xy.LineSeries;
        if (lineSeries !== hoveredSeries) {
          lineSeries.strokes.template.setAll({ strokeOpacity: 0.15 });
        } else {
          lineSeries.strokes.template.setAll({ strokeWidth: 3 });
        }
      });
    });

    legend.itemContainers.template.events.on("pointerout", (event) => {
      const itemContainer = event.target;
      if (!itemContainer.dataItem) {
        return;
      }

      chart.series.each((chartSeries) => {
        const lineSeries = chartSeries as am5xy.LineSeries;
        lineSeries.strokes.template.setAll({
          strokeOpacity: 1,
          strokeWidth: 1,
        });
      });
    });

    legend.events.on("boundschanged", () => {
      const legendHeight = legend.height();
      root.dom.style.height = `${400 + legendHeight + 40}px`;
    });

    rootRef.current = root;
    chartRef.current = chart;
    xAxisRef.current = xAxis;
    legendRef.current = legend;

    chart.appear(1000, 100);

    return () => {
      seriesRef.current.clear();
      legendRef.current = null;
      xAxisRef.current = null;
      chartRef.current = null;
      rootRef.current = null;
      root.dispose();
    };
  }, [valueType, isDekadSeries]);

  useEffect(() => {
    const root = rootRef.current;
    const chart = chartRef.current;
    const xAxis = xAxisRef.current;
    const legend = legendRef.current;
    const yAxis = chart?.yAxes.getIndex(0);

    if (!root || !chart || !xAxis || !legend || !yAxis || !years || !classes) {
      return;
    }

    const sortedYearEntries = sortYearEntries(years);
    const categories = buildYearCategories(sortedYearEntries);

    if (!isDekadSeries) {
      (xAxis as am5xy.CategoryAxis<am5xy.AxisRenderer>).data.setAll(categories);
    }

    const maxVisiblePeriods = isDekadSeries
      ? MAX_VISIBLE_DEKADS
      : MAX_VISIBLE_YEARS;

    if (categories.length > maxVisiblePeriods) {
      xAxis.set("start", 1 - maxVisiblePeriods / categories.length);
      xAxis.set("end", 1);
    } else {
      xAxis.set("start", 0);
      xAxis.set("end", 1);
    }

    const activeSeriesKeys = new Set<string>();

    classes.forEach((cls, classIndex) => {
      const labelSlug = cls.label
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/</g, "menor-que")
        .replace(/>/g, "maior-que")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const translatedLabel = tCaption.has(`labels.${labelSlug}`)
        ? tCaption(`labels.${labelSlug}`)
        : cls.label;

      const seriesKey = `${cls.id}:${cls.label}:${cls.color}`;
      activeSeriesKeys.add(seriesKey);

      let series = seriesRef.current.get(seriesKey);

      if (!series) {
        series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: translatedLabel,
            xAxis,
            yAxis,
            valueYField: "value",
            ...(isDekadSeries
              ? { valueXField: "date" }
              : { categoryXField: "year" }),
            stroke: am5.color(cls.color),
            fill: am5.color(cls.color),
            tooltip: (() => {
              const tooltip = am5.Tooltip.new(root, {
                pointerOrientation: "horizontal",
                labelText:
                  valueType === "absolute"
                    ? `{valueY} ${valueUnit ?? ""}`.trim()
                    : "{valueY}%",
              });
              tooltip.label.setAll({ fontSize: 12 });
              return tooltip;
            })(),
          }),
        );

        series.bullets.push(() =>
          am5.Bullet.new(root, {
            sprite: am5.Circle.new(root, {
              radius: 2,
              fill: am5.color(cls.color),
            }),
          }),
        );

        seriesRef.current.set(seriesKey, series);
      }

      const seriesData = buildSeriesData(
        sortedYearEntries,
        deferredSelectedState,
        classIndex,
      );

      series.data.setAll(
        isDekadSeries
          ? seriesData.map((item) => ({
              ...item,
              date: dekadTimestamp(item.year),
            }))
          : seriesData,
      );
    });

    for (const [seriesKey, series] of seriesRef.current.entries()) {
      if (activeSeriesKeys.has(seriesKey)) {
        continue;
      }

      chart.series.removeValue(series);
      series.dispose();
      seriesRef.current.delete(seriesKey);
    }

    legend.data.setAll(chart.series.values);

    if (isDekadSeries) {
      // No eixo de datas o cursor anda dia a dia; preso aos pontos, a dica do
      // eixo mostra o decêndio, e não o dia sob o mouse.
      chart.get("cursor")?.setAll({
        snapToSeries: chart.series.values,
        snapToSeriesBy: "x",
      });
    }
  }, [
    years,
    classes,
    deferredSelectedState,
    valueType,
    valueUnit,
    isDekadSeries,
  ]);

  return (
    <div className="flex flex-col gap-2">
      <div className="h-6 w-[132px]">
        <h2 className="text-[18px] font-semibold leading-6 text-[#292829]">
          {t("temporalVision")}
        </h2>
      </div>

      <div ref={containerRef} className="min-h-[500px] rounded-lg bg-white" />
    </div>
  );
}
