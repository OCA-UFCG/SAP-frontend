"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { Chevron } from "@/components/Chevron/Chevron";
import SearchBarPlatform from "@/components/SidePanelContexts/SearchBarPlatform";
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
}

const LazyTemporalVision = dynamic<TemporalVisionProps>(
  () =>
    import("@/components/analysis/TemporalVision").then((module) => ({
      default: module.TemporalVision,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-2">
        <div className="h-6 w-[132px] rounded bg-[#E4E5E2] animate-pulse" />
        <div className="min-h-[500px] rounded-lg bg-white animate-pulse" />
      </div>
    ),
  },
);
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

function formatAnalysisYearLabel(text: string) {
  if (!text) return text;

  // matches formats like "2001-07", "2001-07-01", or "2001/07"
  const match = text.match(/^(\d{4})[\/-](\d{2})(?:[\/-]\d{2})?$/);
  if (match) {
    const year = match[1];
    const month = Number(match[2]);
    if (!Number.isNaN(month) && month >= 1 && month <= 12) {
      const months = [
        "janeiro",
        "fevereiro",
        "março",
        "abril",
        "maio",
        "junho",
        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro",
      ];
      const name = months[month - 1];
      return `${name.charAt(0).toUpperCase()}${name.slice(1)} de ${year}`;
    }
  }

  // if it's just a year like "2001", keep as-is
  if (/^\d{4}$/.test(text)) {
    return text;
  }

  return text;
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

  const formattedLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    yearOptions.forEach((opt) => {
      const raw = opt.label ?? opt.value;
      map.set(opt.value, formatAnalysisYearLabel(raw));
    });
    return map;
  }, [yearOptions]);

  const activeOption =
    yearOptions.find((option) => option.value === activeYear) ?? yearOptions[0];

  const activeDisplayLabel =
    formattedLabelMap.get(activeOption?.value ?? activeYear) ??
    activeOption?.label ??
    activeYear;

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
          {activeDisplayLabel}
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
              {formattedLabelMap.get(option.value) ?? option.label}
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
  return Object.fromEntries(
    groups.map((group) => [group.id, "initial"]),
  ) as Record<string, "initial" | "all" | "closed">;
}

function RankingSectionContent({
  groups,
  onItemSelect,
}: {
  groups: AnalysisRankingGroup[];
  onItemSelect?: (locationKey: string) => void;
}) {
  const [groupStates, setGroupStates] = useState<
    Record<string, "initial" | "all" | "closed">
  >(() => getDefaultExpandedGroups(groups));

  return (
    <div className="flex flex-col gap-2">
      {groups.map((group) => {
        const state = groupStates[group.id] ?? "initial";
        const nonZeroCount = group.allItems?.length ?? group.items.length;
        const hasItems = (nonZeroCount ?? 0) > 0;
        const headerTextColor = getContrastTextColor(group.tone.color);
        const badgeBackgroundColor = buildRankingBadgeColor(group.tone.color);
        const badgeTextColor = getContrastTextColor(badgeBackgroundColor);
        const toggleLabel = !hasItems
          ? "Sem estados com valor"
          : state === "all"
            ? "Ocultar lista"
            : `Ver todos (${nonZeroCount})`;

        const isOpen = state === "all";

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
                  {nonZeroCount}
                </span>
                <span className="text-[12px] font-semibold leading-6">
                  {group.totalLabel}
                </span>
              </div>
            </div>

            {hasItems && state !== "closed" ? (
              <div className="flex flex-col gap-2 bg-white p-2">
                {(state === "initial"
                  ? group.items
                  : (group.allItems ?? group.items)
                ).map((item) => (
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
              aria-expanded={hasItems ? isOpen : undefined}
              aria-label={
                hasItems
                  ? `${isOpen ? "Ocultar" : "Mostrar"} ${group.label}`
                  : undefined
              }
              onClick={() => {
                if (!hasItems) {
                  return;
                }

                setGroupStates((current) => {
                  const cur = current[group.id] ?? "initial";
                  const next =
                    cur === "initial"
                      ? "all"
                      : cur === "all"
                        ? "closed"
                        : "all";
                  return {
                    ...current,
                    [group.id]: next,
                  };
                });
              }}
              className="flex min-h-7 w-full items-center justify-center gap-2 bg-[#C8CAC5] px-2 py-1 text-[12px] font-medium leading-5 text-[#292829] transition-colors duration-150 enabled:cursor-pointer enabled:hover:bg-[#BFC2BC] disabled:cursor-default"
            >
              <span className="font-inter">{toggleLabel}</span>
              {hasItems ? (
                <Chevron open={isOpen} from="down" to="up" size={16} />
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
  const hasTemporalData = Boolean(
    years && classes && Object.keys(years).length > 0 && classes.length > 0,
  );

  const panelRef = useRef<HTMLDivElement | null>(null);

  const handleRankingItemSelect = (locationKey: string) => {
    const el = panelRef.current;
    if (el) {
      if (typeof el.scrollTo === "function") {
        try {
          el.scrollTo({ top: 0, behavior: "smooth" });
        } catch {
          el.scrollTop = 0;
        }
      } else {
        el.scrollTop = 0;
      }
    }

    onRankingItemSelect?.(locationKey);
  };

  return (
    <div
      ref={panelRef}
      className="h-full overflow-y-auto bg-[#F6F7F6] px-4 pb-6"
    >
      <div className="flex flex-col gap-6">
        <div
          className="group sticky top-0 z-10 -mx-4 bg-[#F0F0D7] px-4 pb-2 pt-6 border-b border-[#EFEFEF] transition-colors duration-150 hover:bg-[#E6E9C7]"
          data-testid="analysis-panel-back-header"
        >
          <button
            type="button"
            onClick={onBack}
            className="flex w-[194px] h-8 cursor-pointer items-center gap-2 rounded-[8px] bg-transparent px-2 py-1.5 text-[14px] font-medium text-[#21240F] transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-neutral-600 focus-visible:outline-none"
          >
            <Chevron open={false} from="right" to="left" size={16} />
            <span>Voltar para listagem</span>
          </button>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -bottom-3 h-3 bg-gradient-to-b from-[#F0F0D7]/40 to-transparent group-hover:from-[#E6E9C7]/40 transition-colors duration-150"
          />
        </div>

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
                style={{ color: "#989F43" }}
              >
                {model.name}
              </div>
            </div>

            <div className="flex w-full max-w-[392px] flex-col gap-2">
              <div className="text-[18px] font-semibold leading-6 text-[#292829]">
                Informações gerais
              </div>

              {model.highlight ? (
                <div
                  className="flex h-[40px] w-full items-center px-4 rounded-lg"
                  style={{
                    backgroundColor:
                      model.highlight.tone?.bg ??
                      model.highlight.tone?.color ??
                      model.accentColor ??
                      "#F5F5F5",
                    border: `1px solid ${
                      model.highlight.tone?.border ?? "#F0F0D7"
                    }`,
                  }}
                >
                  <span className="font-semibold text-[14px] leading-6 text-[#292829]">
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
              onItemSelect={handleRankingItemSelect}
            />
            {hasTemporalData ? (
              <LazyTemporalVision
                years={years}
                classes={classes}
                selectedState={selectedState}
              />
            ) : null}
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
