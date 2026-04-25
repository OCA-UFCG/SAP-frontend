import { useLayoutEffect } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import type { CompactAnalysisClass, CompactAnalysisYearData } from "@/utils/analysis";

interface TemporalVisionProps {
    years?: Record<string, CompactAnalysisYearData>;
    classes?: CompactAnalysisClass[];
    selectedState?: string;
}

export function TemporalVision({ years, classes, selectedState = "br" }: TemporalVisionProps) {
    useLayoutEffect(() => {
        const root = am5.Root.new("chartdiv");

        const myTheme = am5.Theme.new(root);
        myTheme.rule("AxisLabel", ["minor"]).setAll({ dy: 1 });
        myTheme.rule("Grid", ["x"]).setAll({ strokeOpacity: 0.05 });
        myTheme.rule("Grid", ["x", "minor"]).setAll({ strokeOpacity: 0.05 });

        root.setThemes([am5themes_Animated.new(root), myTheme]);

        const chart = root.container.children.push(am5xy.XYChart.new(root, {
            panX: true,
            panY: false,
            wheelX: "panX",
            wheelY: "none",
            pinchZoomX: true,
            layout: root.verticalLayout,
        }));

        // X axis: year categories
        const xRenderer = am5xy.AxisRendererX.new(root, {
            minGridDistance: 60,
        });
        xRenderer.labels.template.setAll({
            paddingTop: 12,
        });
        const xAxis = chart.xAxes.push(am5xy.CategoryAxis.new(root, {
            categoryField: "year",
            renderer: xRenderer,
            tooltip: am5.Tooltip.new(root, {}),
        }));

        // Limit initial view to 8 years; user can pan to see the rest
        const MAX_VISIBLE = 8;

        // Y axis: percentage 0–100 with fixed ticks every 20
        const yAxisRenderer = am5xy.AxisRendererY.new(root, {});
        const yAxis = chart.yAxes.push(am5xy.ValueAxis.new(root, {
            min: 0,
            max: 100,
            strictMinMax: true,
            renderer: yAxisRenderer,
        }));
        // Force grid lines and labels at 0, 20, 40, 60, 80, 100
        yAxis.get("renderer").labels.template.adapters.add("text", (_text, target) => {
            const value = target.dataItem?.get("value" as never) as number | undefined;
            if (value === undefined) return _text;
            return value % 20 === 0 ? `${value}%` : "";
        });
        yAxis.get("renderer").grid.template.adapters.add("strokeOpacity", (_opacity, target) => {
            const value = target.dataItem?.get("value" as never) as number | undefined;
            if (value === undefined) return 0;
            return value % 20 === 0 ? 0.15 : 0;
        });

        const hasData = years && classes && Object.keys(years).length > 0 && classes.length > 0;

        if (hasData) {
            // Sort year entries by key so the X axis reads chronologically
            const sortedYearEntries = Object.entries(years!).sort(([a], [b]) =>
                a.localeCompare(b)
            );

            // X axis categories: one per year
            const xCategories = sortedYearEntries.map(([yearKey, yearData]) => ({
                year: yearData.year ?? yearKey,
            }));
            xAxis.data.setAll(xCategories);

            // Show at most MAX_VISIBLE years at once; user can pan to see the rest
            if (xCategories.length > MAX_VISIBLE) {
                xAxis.set("start", 1 - MAX_VISIBLE / xCategories.length);
                xAxis.set("end", 1);
            }

            // One series per classification class
            classes!.forEach((cls, classIndex) => {
                const series = chart.series.push(am5xy.LineSeries.new(root, {
                    name: cls.label,
                    xAxis,
                    yAxis,
                    valueYField: "value",
                    categoryXField: "year",
                    stroke: am5.color(cls.color),
                    fill: am5.color(cls.color),
                    tooltip: am5.Tooltip.new(root, {
                        pointerOrientation: "horizontal",
                        labelText: "{valueY}%",
                    }),
                }));

                // For each year, get the value at [classIndex] for the selected state
                const seriesData = sortedYearEntries.map(([yearKey, yearData]) => {
                    // Try the selectedState first, then fallback to "br"
                    const locationValues =
                        yearData.values[selectedState] ??
                        yearData.values["br"] ??
                        [];

                    // valuesScale is a DIVISOR — same logic as analysis.mappers.ts line 67:
                    // value = raw / scale (values are stored multiplied by scale)
                    const scale = yearData.valuesScale ?? 1;
                    const raw = (locationValues[classIndex] ?? 0) as number;
                    const percentage = Number((raw / scale).toFixed(1));

                    return {
                        year: yearData.year ?? yearKey,
                        value: percentage,
                    };
                });

                series.data.setAll(seriesData);
                series.appear();

                // Style bullets (data points on the line)
                series.bullets.push(() =>
                    am5.Bullet.new(root, {
                        sprite: am5.Circle.new(root, {
                            radius: 2.5,
                            fill: am5.color(cls.color),
                        }),
                    })
                );

            });
        } else {
            // Fallback demo when no real data
            const xCategories = [
                { year: "2019" }, { year: "2020" }, { year: "2021" },
                { year: "2022" }, { year: "2023" },
            ];
            xAxis.data.setAll(xCategories);

            const demoSeries = chart.series.push(am5xy.LineSeries.new(root, {
                name: "Demo",
                xAxis,
                yAxis,
                valueYField: "value",
                categoryXField: "year",
                tooltip: am5.Tooltip.new(root, { labelText: "{valueY}%" }),
            }));
            demoSeries.data.setAll([
                { year: "2019", value: 40 }, { year: "2020", value: 55 },
                { year: "2021", value: 48 }, { year: "2022", value: 62 },
                { year: "2023", value: 43 },
            ]);
            demoSeries.appear();
        }

        // Scrollbar X — lets user pan when there are many years
        const scrollbar = chart.set("scrollbarX", am5xy.XYChartScrollbar.new(root, {
            orientation: "horizontal",
            height: 30,
        }));

        // Mirror a simplified overview series in the scrollbar
        const sbxAxis = scrollbar.chart.xAxes.push(am5xy.CategoryAxis.new(root, {
            categoryField: "year",
            renderer: am5xy.AxisRendererX.new(root, {}),
        }));
        const sbyAxis = scrollbar.chart.yAxes.push(am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, {}),
        }));

        if (hasData && chart.series.length > 0) {
            const firstSeries = chart.series.getIndex(0) as am5xy.LineSeries;
            const sbSeries = scrollbar.chart.series.push(am5xy.LineSeries.new(root, {
                xAxis: sbxAxis,
                yAxis: sbyAxis,
                valueYField: "value",
                categoryXField: "year",
            }));
            sbSeries.data.setAll(firstSeries.data.values);
            sbxAxis.data.setAll(firstSeries.data.values);
        }

        // Cursor (only X line)
        const cursor = chart.set("cursor", am5xy.XYCursor.new(root, {
            behavior: "none",
        }));
        cursor.lineY.set("visible", false);

        // Legend below chart
        const legend = chart.children.push(am5.Legend.new(root, {
            x: am5.percent(0),
            centerX: am5.percent(0),
            paddingTop: 15,
            width: am5.percent(100),
            layout: am5.GridLayout.new(root, {
                maxColumns: 2,
                fixedWidthGrid: false,
            }),
        }));

        legend.itemContainers.template.events.on("pointerover", (e) => {
            const itemContainer = e.target;
            if (!itemContainer.dataItem) return;
            const hoveredSeries = itemContainer.dataItem.dataContext;
            chart.series.each((chartSeries) => {
                const ls = chartSeries as am5xy.LineSeries;
                if (ls !== hoveredSeries) {
                    ls.strokes.template.setAll({ strokeOpacity: 0.15 });
                } else {
                    ls.strokes.template.setAll({ strokeWidth: 3 });
                }
            });
        });

        legend.itemContainers.template.events.on("pointerout", (e) => {
            const itemContainer = e.target;
            if (!itemContainer.dataItem) return;
            chart.series.each((chartSeries) => {
                const ls = chartSeries as am5xy.LineSeries;
                ls.strokes.template.setAll({ strokeOpacity: 1, strokeWidth: 1 });
            });
        });

        legend.data.setAll(chart.series.values);
        chart.appear(1000, 100);

        return () => {
            root.dispose();
        };
    }, [years, classes, selectedState]);

    return (
        <>
            <div className="h-6 w-[132px]">
                <h2 className="text-[18px] font-semibold leading-6 text-[#292829]">
                    Visão temporal
                </h2>
            </div>

            <div id="chartdiv" className="min-h-[500px] rounded-lg bg-white">
                {/* Aqui fica a visualizacao grafica ou imagem da serie temporal. */}
            </div>
        </>
    );
}