"use client";

import { useEffect, useRef, useState } from "react";
import { Chevron } from "@/components/Chevron/Chevron";
import SearchBarPlatform from "@/components/SidePanelContexts/SearchBarPlatform";
import type {
  AnalysisDistributionItem,
  AnalysisRankingGroup,
  AnalysisYearOption,
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
  emptyStateTitle?: string;
  emptyStateDescription?: string;
}

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

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-[14px] font-semibold leading-6 text-[#292829]">
        {title}
      </h2>
      <div className="flex flex-col gap-3">
        {groups.map((group) => (
          <div
            key={group.id}
            className="overflow-hidden rounded-lg border border-[#EFEFEF] bg-white shadow-sm"
          >
            <div className="flex items-center justify-between bg-[#F0F0D7] px-4 py-3">
              <span className="text-[16px] font-semibold text-[#292829]">
                {group.label}
              </span>
              <span className="rounded-md bg-[#2D3215] px-3 py-2 text-[12px] font-semibold text-white">
                {group.total} {group.totalLabel}
              </span>
            </div>

            <div className="flex flex-col gap-2 p-3">
              {group.items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onItemSelect?.(item.id)}
                  className="flex items-center justify-between rounded-md bg-[#F7F7F7] px-3 py-2 text-left text-[13px] text-[#292829] transition-colors duration-150 hover:bg-[#EFEFEF]"
                >
                  <span>{item.label}</span>
                  {item.trailingLabel ? (
                    <span className="text-[12px] text-neutral-500">
                      {item.trailingLabel}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
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
