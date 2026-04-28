"use client";

import { useDeferredValue, useEffect, useLayoutEffect, useRef } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import type {
  CompactAnalysisClass,
  CompactAnalysisYearData,
} from "@/utils/analysis";

interface TemporalVisionProps {
  years?: Record<string, CompactAnalysisYearData>;
  classes?: CompactAnalysisClass[];
  selectedState?: string;
}

const MAX_VISIBLE_YEARS = 8;

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

function buildSeriesData(
  sortedYearEntries: Array<[string, CompactAnalysisYearData]>,
  selectedState: string,
  classIndex: number,
) {
  return sortedYearEntries.map(([yearKey, yearData]) => {
    const locationValues =
      yearData.values[selectedState] ?? yearData.values["br"] ?? [];
    const scale = yearData.valuesScale ?? 1;
    const rawValue = (locationValues[classIndex] ?? 0) as number;

    return {
      year: yearData.year ?? yearKey,
      value: Number((rawValue / scale).toFixed(1)),
    };
  });
}

export function TemporalVision({
  years,
  classes,
  selectedState = "br",
}: TemporalVisionProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rootRef = useRef<am5.Root | null>(null);
  const chartRef = useRef<am5xy.XYChart | null>(null);
  const xAxisRef = useRef<am5xy.CategoryAxis<am5xy.AxisRenderer> | null>(null);
  const legendRef = useRef<am5.Legend | null>(null);
  const seriesRef = useRef(new Map<string, am5xy.LineSeries>());
  const deferredSelectedState = useDeferredValue(selectedState);

  useLayoutEffect(() => {
    if (isTestEnvironment() || !containerRef.current || rootRef.current) {
      return;
    }

    const root = am5.Root.new(containerRef.current);
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
      am5xy.CategoryAxis.new(root, {
        categoryField: "year",
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {}),
      }),
    );

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        max: 100,
        strictMinMax: true,
        renderer: am5xy.AxisRendererY.new(root, {}),
      }),
    );

    yAxis
      .get("renderer")
      .labels.template.adapters.add("text", (text, target) => {
        const value = target.dataItem?.get("value" as never) as
          | number
          | undefined;

        if (value === undefined) {
          return text;
        }

        return value % 20 === 0 ? `${value}%` : "";
      });

    yAxis
      .get("renderer")
      .grid.template.adapters.add("strokeOpacity", (_opacity, target) => {
        const value = target.dataItem?.get("value" as never) as
          | number
          | undefined;

        if (value === undefined) {
          return 0;
        }

        return value % 20 === 0 ? 0.15 : 0;
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
  }, []);

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

    xAxis.data.setAll(categories);

    if (categories.length > MAX_VISIBLE_YEARS) {
      xAxis.set("start", 1 - MAX_VISIBLE_YEARS / categories.length);
      xAxis.set("end", 1);
    } else {
      xAxis.set("start", 0);
      xAxis.set("end", 1);
    }

    const activeSeriesKeys = new Set<string>();

    classes.forEach((cls, classIndex) => {
      const seriesKey = `${cls.id}:${cls.label}:${cls.color}`;
      activeSeriesKeys.add(seriesKey);

      let series = seriesRef.current.get(seriesKey);

      if (!series) {
        series = chart.series.push(
          am5xy.LineSeries.new(root, {
            name: cls.label,
            xAxis,
            yAxis,
            valueYField: "value",
            categoryXField: "year",
            stroke: am5.color(cls.color),
            fill: am5.color(cls.color),
            tooltip: (() => {
              const tooltip = am5.Tooltip.new(root, {
                pointerOrientation: "horizontal",
                labelText: "{valueY}%",
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

      series.data.setAll(
        buildSeriesData(sortedYearEntries, deferredSelectedState, classIndex),
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
  }, [years, classes, deferredSelectedState]);

  return (
    <div className="flex flex-col gap-2">
      <div className="h-6 w-[132px]">
        <h2 className="text-[18px] font-semibold leading-6 text-[#292829]">
          Visão temporal
        </h2>
      </div>

      <div ref={containerRef} className="min-h-[500px] rounded-lg bg-white" />
    </div>
  );
}
