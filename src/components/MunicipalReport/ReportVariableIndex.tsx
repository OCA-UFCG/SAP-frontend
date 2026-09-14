"use client";

import { useTranslations } from "next-intl";
import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import {
  formatReportPeriodPill,
  groupReportAnalysesByCategory,
  REPORT_CATEGORY_TOKENS,
  reportAnalysisAnchorId,
} from "@/utils/municipalReportCategories";

export function ReportVariableIndex({
  analyses,
  translateTitle,
}: {
  analyses: readonly MunicipalReportAnalysis[];
  translateTitle: (analysis: MunicipalReportAnalysis) => string;
}) {
  const t = useTranslations("MunicipalReport");
  const tModules = useTranslations("ModulesContext");
  const groups = groupReportAnalysesByCategory(analyses);

  if (groups.length === 0) return null;

  return (
    <nav
      className="report-variable-index"
      aria-label={t("document.variableIndexTitle")}
    >
      <div className="grid gap-4 md:grid-cols-3">
        {groups.map((group) => {
          const tokens = REPORT_CATEGORY_TOKENS[group.key];

          return (
            <section key={group.key} className="flex min-w-0 flex-col gap-2 pb-4 pt-1">
              <h3 className="font-inter text-base font-medium leading-6 text-[#292829]">
                {tModules(`categories.${group.key}`)}
              </h3>
              <ul className="flex flex-col gap-2">
                {group.analyses.map((analysis) => {
                  const title = translateTitle(analysis);

                  return (
                    <li key={analysis.id}>
                      <a
                        href={`#${reportAnalysisAnchorId(analysis.alias)}`}
                        aria-label={t("document.goToSection", { title })}
                        className="flex items-stretch overflow-hidden rounded-lg border border-[#EFEFEF] bg-white transition hover:border-[#C8CAC5]"
                      >
                        <span className="flex min-w-0 flex-1 items-center gap-2 py-2 pl-2 pr-2">
                          <span
                            className="font-inter min-w-0 flex-1 truncate text-xs font-semibold leading-6 tracking-[-0.18px] text-[#292829]"
                            title={title}
                          >
                            {title}
                          </span>
                          <span
                            className="font-open-sans shrink-0 rounded-[74px] px-2 text-[10px] leading-6 tabular-nums"
                            style={{
                              backgroundColor: tokens.pill,
                              color: tokens.pillInk,
                            }}
                          >
                            {formatReportPeriodPill(analysis.effectivePeriod)}
                          </span>
                        </span>
                        <span className="flex w-10 shrink-0 items-center justify-center border-l border-[#EFEFEF] p-2 print:hidden">
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 20 20"
                            className="size-4 text-[#989F43]"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.8"
                          >
                            <path
                              d="M7.5 5L12.5 10L7.5 15"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </nav>
  );
}
