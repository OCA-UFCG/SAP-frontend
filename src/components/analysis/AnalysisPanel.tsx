"use client";

import { Chevron } from "@/components/Chevron/Chevron";
import SearchBarPlatform from "@/components/SidePanelContexts/SearchBarPlatform";
import { TemporalVision } from "@/components/TemporalVision/TemporalVision";
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
          <h1 className="font-['Inter'] text-[24px] font-semibold leading-[24px] tracking-[-0.015em]">
            Análise do módulo {moduleName}
          </h1>
          <p className="font-['Inter'] text-[16px] font-medium leading-[24px] tracking-[-0.015em]">
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

            <select
              value={activeYear}
              onChange={(event) => onYearChange(event.target.value)}
              className="h-[40px] min-h-[36px] w-full rounded-md border border-[#DCDBDC] bg-white px-3 py-2 text-[14px] leading-[24px] text-[#292829] focus:outline-none"
            >
              {yearOptions.map((year) => (
                <option key={year.value} value={year.value}>
                  {year.label}
                </option>
              ))}
            </select>
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
