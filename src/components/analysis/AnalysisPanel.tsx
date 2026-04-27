"use client";

import { useEffect, useRef, useState } from "react";
import { Chevron } from "@/components/Chevron/Chevron";
import SearchBarPlatform from "@/components/SidePanelContexts/SearchBarPlatform";
import { useLayoutEffect } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5xy from "@amcharts/amcharts5/xy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { getContrastTextColor } from "@/utils/functions";
import type {
  AnalysisDistributionItem,
  AnalysisRankingGroup,
  AnalysisYearOption,
  CompactAnalysisClass,
  CompactAnalysisYearData,
  TerritorialAnalysisViewModel,
} from "@/utils/analysis";

interface AnalysisPanelProps {
  moduleName?: string;
  yearOptions: AnalysisYearOption[];
  activeYear: string;
  onBack: () => void;
  onSearch: (value: string) => void;
  onYearChange: (year: string) => void;
  onRankingItemSelect?: (locationKey: string) => void;
  model: TerritorialAnalysisViewModel | null;
  years?: Record<string, CompactAnalysisYearData>;
  classes?: CompactAnalysisClass[];
  selectedState?: string;
  emptyStateTitle?: string;
  emptyStateDescription?: string;
}

interface TemporalVisionProps {
  years?: Record<string, CompactAnalysisYearData>;
  classes?: CompactAnalysisClass[];
  selectedState?: string;
interface AnalysisYearSelectProps {
  activeYear: string;
  yearOptions: AnalysisYearOption[];
  onYearChange: (year: string) => void;
}

function renderFormattedText(text: string) {
  const parts = text.split(/(\d+(?:\.\d+)?% [^,.]+)/g);

  return parts.map((part, index) =>
    /\d+(?:\.\d+)?%/.test(part) ? (
      <strong key={index} className="font-bold text-[#292829]">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

function EmptySection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[14px] font-semibold leading-6 text-[#292829]">
        {title}
      </h2>
      <div className="rounded-lg border border-[#EFEFEF] bg-white p-4 text-[12px] leading-5 text-neutral-600 shadow-sm">
        {description}
      </div>
    </div>
  );
}

function AnalysisYearSelect({
  activeYear,
  yearOptions,
  onYearChange,
}: AnalysisYearSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);

  const activeOption =
    yearOptions.find((option) => option.value === activeYear) ?? yearOptions[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOptionsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setIsOptionsOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-transparent bg-[#E4E5E2] px-3 py-3 text-left shadow-sm transition hover:border-neutral-400 focus-visible:border-neutral-600 focus-visible:ring-2 focus-visible:ring-neutral-600 focus-visible:outline-none"
        aria-haspopup="listbox"
        aria-expanded={isOptionsOpen}
        aria-controls="analysis-year-options"
      >
        <span className="truncate text-sm text-[#292829]">
          {activeOption?.label ?? activeYear}
        </span>

        <svg
          width="16"
          height="16"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`ml-2 shrink-0 text-[#898989] transition-transform ${isOptionsOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            d="M5 7.5L10 12.5L15 7.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOptionsOpen && (
        <div
          id="analysis-year-options"
          role="listbox"
          className="absolute top-[calc(100%+8px)] z-20 max-h-64 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 shadow-lg"
        >
          {yearOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={activeYear === option.value}
              onClick={() => {
                setIsOptionsOpen(false);
                onYearChange(option.value);
              }}
              className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[#292829] transition hover:bg-[#F6F7F6]"
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DistributionSection({ items }: { items: AnalysisDistributionItem[] }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[14px] font-semibold leading-6 text-[#292829]">
        Porcentagem de área por classificação
      </h2>

      <div className="rounded-lg border border-[#EFEFEF] bg-white p-3 shadow-sm">
        <div className="flex h-10 w-full overflow-hidden rounded-md">
          {items
            .filter((item) => item.value > 0)
            .map((item) => (
              <div
                key={item.id}
                style={{ width: `${item.value}%`, backgroundColor: item.color }}
                className="flex items-center justify-center border-r border-white/20 text-[12px] font-bold text-[#292829] transition-all duration-500 last:border-0"
                title={`${item.label}: ${item.value}%`}
              >
                {item.value > 10 && `${item.value}%`}
              </div>
            ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2">
              <div
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="truncate text-[12px] text-neutral-600">
                {item.label}: <span className="font-bold">{item.value}%</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function parseHexColor(color: string) {
  const normalized = color.trim().replace("#", "");

  if (!/^(?:[\da-fA-F]{3}|[\da-fA-F]{6})$/.test(normalized)) {
    return null;
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((character) => character + character)
          .join("")
      : normalized;

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function buildRankingBadgeColor(color: string) {
  const rgb = parseHexColor(color);

  if (!rgb) {
    return "#21240F";
  }

  return `rgb(${Math.round(rgb.r * 0.18)}, ${Math.round(rgb.g * 0.18)}, ${Math.round(rgb.b * 0.18)})`;
}

function getDefaultExpandedGroups(groups: AnalysisRankingGroup[]) {
  return Object.fromEntries(groups.map((group) => [group.id, true]));
}

function RankingSectionContent({
  groups,
  onItemSelect,
}: {
  groups: AnalysisRankingGroup[];
  onItemSelect?: (locationKey: string) => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(
    () => getDefaultExpandedGroups(groups),
  );

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => {
        const isExpanded = expandedGroups[group.id] ?? true;
        const hasItems = group.items.length > 0;
        const headerTextColor = getContrastTextColor(group.tone.color);
        const badgeBackgroundColor = buildRankingBadgeColor(group.tone.color);
        const badgeTextColor = getContrastTextColor(badgeBackgroundColor);
        const toggleLabel = hasItems
          ? isExpanded
            ? "Ocultar lista"
            : `Ver top ${group.items.length}`
          : "Sem estados com valor";

        return (
          <div
            key={group.id}
            className="overflow-hidden rounded-lg border border-[#EFEFEF] bg-white"
          >
            <div
              className="flex min-h-14 items-stretch justify-between pl-3"
              style={{ backgroundColor: group.tone.color }}
            >
              <span
                className="flex items-center pr-4 text-[16px] font-semibold leading-[22px] tracking-[-0.03em]"
                style={{ color: headerTextColor }}
              >
                {group.label}
              </span>

              <div
                className="flex min-h-14 min-w-[97px] shrink-0 flex-col items-center justify-center px-2"
                style={{
                  backgroundColor: badgeBackgroundColor,
                  color: badgeTextColor,
                }}
              >
                <span className="text-[24px] font-semibold leading-5 tracking-[-0.03em]">
                  {group.total}
                </span>
                <span className="text-[12px] font-semibold leading-6">
                  {group.totalLabel}
                </span>
              </div>
            </div>

            {isExpanded && hasItems ? (
              <div className="flex flex-col gap-2 bg-white p-2">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onItemSelect?.(item.id)}
                    title={
                      item.trailingLabel
                        ? `${item.label}: ${item.trailingLabel}`
                        : item.label
                    }
                    aria-label={
                      item.trailingLabel
                        ? `${item.label}: ${item.trailingLabel}`
                        : item.label
                    }
                    className="flex min-h-8 items-center justify-between gap-2 rounded-lg bg-[#E4E5E2] px-2 py-1.5 text-left transition-colors duration-150 hover:bg-[#D7D9D4]"
                  >
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span className="truncate text-[14px] leading-5 text-[#292829]">
                        {item.label}
                      </span>
                      {item.trailingLabel ? (
                        <span className="shrink-0 text-[12px] font-medium leading-5 text-[#292829]">
                          {item.trailingLabel}
                        </span>
                      ) : null}
                    </span>
                    <Chevron open from="right" to="right" size={16} />
                  </button>
                ))}
              </div>
            ) : null}

            <button
              type="button"
              disabled={!hasItems}
              aria-expanded={hasItems ? isExpanded : undefined}
              aria-label={
                hasItems
                  ? `${isExpanded ? "Ocultar" : "Mostrar"} ${group.label}`
                  : undefined
              }
              onClick={() => {
                if (!hasItems) {
                  return;
                }

                setExpandedGroups((current) => ({
                  ...current,
                  [group.id]: !isExpanded,
                }));
              }}
              className="flex min-h-7 w-full items-center justify-center gap-2 bg-[#C8CAC5] px-2 py-1 text-[12px] font-medium leading-5 text-[#292829] transition-colors duration-150 enabled:cursor-pointer enabled:hover:bg-[#BFC2BC] disabled:cursor-default"
            >
              <span className="font-inter">{toggleLabel}</span>
              {hasItems ? (
                <Chevron open={isExpanded} from="up" to="down" size={16} />
              ) : null}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function RankingSection({
  title,
  groups,
  onItemSelect,
}: {
  title: string;
  groups: AnalysisRankingGroup[];
  onItemSelect?: (locationKey: string) => void;
}) {
  if (groups.length === 0) {
    return (
      <EmptySection
        title={title}
        description="Os agrupamentos por classificação ainda não estão disponíveis para esta camada."
      />
    );
  }

  const rankingGroupsKey = groups
    .map(
      (group) =>
        `${group.id}:${group.total}:${group.items.map((item) => item.id).join(",")}`,
    )
    .join("|");

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[18px] font-semibold leading-6 text-[#292829]">
        {title}
      </h2>
      <RankingSectionContent
        key={rankingGroupsKey}
        groups={groups}
        onItemSelect={onItemSelect}
      />
    </div>
  );
}

function TemporalVision({ years, classes, selectedState = "br" }: TemporalVisionProps) {
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
          tooltip: (() => {
            const tt = am5.Tooltip.new(root, {
              pointerOrientation: "horizontal",
              labelText: "{valueY}%",
            });
            tt.label.setAll({ fontSize: 12 });
            return tt;
          })(),
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
              radius: 2.0,
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
      height: 120,
      layout: am5.GridLayout.new(root, {
        maxColumns: 2,
        fixedWidthGrid: false,
      }),
      verticalScrollbar: am5.Scrollbar.new(root, {
        orientation: "vertical"
      })
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

export function AnalysisPanel({
  moduleName,
  yearOptions,
  activeYear,
  onBack,
  onSearch,
  onYearChange,
  onRankingItemSelect,
  model,
  years,
  classes,
  selectedState,
  emptyStateTitle,
  emptyStateDescription,
}: AnalysisPanelProps) {
  return (
    <div className="h-full overflow-y-auto bg-[#F6F7F6] px-4 pt-12 pb-6">
      <div className="flex flex-col gap-6">
        <button
          type="button"
          onClick={onBack}
          className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-[#EFEFEF] bg-white px-2 py-1.5 text-sm font-medium text-slate-700 transition-colors duration-150 hover:bg-[#F8F7F8]"
        >
          <Chevron open from="right" to="left" size={16} />
          <span>Voltar para módulos</span>
        </button>

        <header className="flex flex-col gap-2">
          <h1 className="font-inter text-[24px] font-semibold leading-[24px] tracking-[-0.015em]">
            Análise do módulo {moduleName}
          </h1>
          <p className="font-inter text-[16px] font-medium leading-[24px] tracking-[-0.015em]">
            Pesquise um estado ou cidade para iniciar análise
          </p>
        </header>

        <section className="flex flex-col gap-8">
          <div className="flex gap-4">
            <SearchBarPlatform onSearch={onSearch} />
          </div>

          <div className="flex w-full max-w-[392px] flex-col items-start gap-[6px]">
            <label className="text-[14px] font-medium leading-[20px] text-[#292829]">
              Data da análise
            </label>

            <AnalysisYearSelect
              activeYear={activeYear}
              yearOptions={yearOptions}
              onYearChange={onYearChange}
            />
          </div>
        </section>

        {model ? (
          <section className="flex flex-col gap-4">
            <div className="mb-4 flex flex-col">
              <div
                className="text-[18px] font-semibold leading-6"
                style={{ color: model.accentColor }}
              >
                {model.name}
              </div>
            </div>

            <div className="flex w-full max-w-[392px] flex-col gap-2">
              <div className="text-[18px] font-semibold leading-6 text-[#292829]">
                Informações gerais
              </div>

              {model.highlight ? (
                <div className="flex h-[40px] w-full items-center gap-4 rounded-lg bg-white pr-6">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border p-2"
                    style={{
                      backgroundColor: model.highlight.tone.bg,
                      borderColor: model.highlight.tone.border,
                    }}
                  >
                    <svg className="h-6 w-6">
                      <use
                        xlinkHref="/sprite.svg#check"
                        stroke={model.highlight.tone.color}
                        strokeWidth="0.2"
                        fill="none"
                      />
                    </svg>
                  </div>

                  <span className="w-fit break-words text-[14px] font-semibold leading-6 text-[#292829]">
                    {model.highlight.text}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col gap-2">
              <h2 className="text-[18px] font-semibold leading-6 text-[#292829]">
                O que está acontecendo?
              </h2>
              <div className="rounded-lg">
                <p className="mt-1 text-[12px] text-sm leading-relaxed text-neutral-600">
                  {renderFormattedText(model.happening)}
                </p>
              </div>
            </div>

            <DistributionSection items={model.distribution} />
            <RankingSection
              title={model.rankingTitle ?? "Territórios por classificação"}
              groups={model.rankingGroups}
              onItemSelect={onRankingItemSelect}
            />
            <TemporalVision years={years} classes={classes} selectedState={selectedState} />
          </section>
        ) : (
          <EmptySection
            title={emptyStateTitle ?? "Análise indisponível"}
            description={
              emptyStateDescription ??
              "Os dados de análise ainda não estão disponíveis para este local neste módulo."
            }
          />
        )}
      </div>
    </div>
  );
}
