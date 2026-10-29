"use client";

import type { MouseEvent } from "react";
import { useTranslations } from "next-intl";
import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import {
  groupReportAnalysesByCategory,
  reportAnalysisAnchorId,
  type ReportCategoryGroup,
} from "@/utils/municipalReportCategories";
import { easeScrollTo, findScrollableAncestor } from "@/utils/reportScroll";

function handleAnchorClick(
  event: MouseEvent<HTMLAnchorElement>,
  anchorId: string,
) {
  if (event.defaultPrevented || event.button !== 0) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  const target = document.getElementById(anchorId);
  if (!target) return;

  const scrollable = findScrollableAncestor(target);
  if (!scrollable) return;

  event.preventDefault();

  const sticky = scrollable.querySelector<HTMLElement>(".report-back-to-top");
  const stickyHeight = sticky ? sticky.getBoundingClientRect().height : 0;
  const top =
    scrollable.scrollTop +
    target.getBoundingClientRect().top -
    scrollable.getBoundingClientRect().top -
    stickyHeight;

  easeScrollTo(scrollable, Math.max(0, top));
}

/** As linhas de uma categoria, contando os subtópicos. */
function countRows(group: ReportCategoryGroup<ReportSummaryItem>) {
  return group.analyses.reduce(
    (sum, item) => sum + 1 + (item.entries?.length ?? 0),
    0,
  );
}

/**
 * As duas colunas do sumário, sem partir uma categoria ao meio: a esquerda
 * recebe categorias até ter pelo menos metade das entradas, e o resto empilha à
 * direita. No relatório típico, com muitos índices climáticos, isso dá o
 * desenho do design: climáticos à esquerda, ambientais e socioeconômicos à
 * direita.
 */
function splitIntoColumns<T extends ReportSummaryItem>(
  groups: readonly ReportCategoryGroup<T>[],
) {
  const total = groups.reduce((sum, group) => sum + countRows(group), 0);
  let leftCount = 0;
  let leftGroups = 0;

  while (
    leftGroups < groups.length &&
    (leftGroups === 0 || leftCount < total / 2)
  ) {
    leftCount += countRows(groups[leftGroups]);
    leftGroups += 1;
  }

  return [groups.slice(0, leftGroups), groups.slice(leftGroups)];
}

/** Um subtópico do sumário, com uma linha menor de detalhe embaixo. */
export interface ReportSummaryEntry {
  alias: string;
  title: string;
  detail?: string;
}

/**
 * Uma linha do sumário: uma análise, ou "Previsão climática", que leva à
 * primeira previsão e lista cada seção de previsão como subtópico.
 */
export type ReportSummaryItem = Pick<
  MunicipalReportAnalysis,
  "id" | "alias" | "category"
> & { entries?: ReportSummaryEntry[] };

function ReportSummaryLink({
  anchorId,
  title,
  detail,
  page,
  nested = false,
}: {
  anchorId: string;
  title: string;
  detail?: string;
  page?: number;
  nested?: boolean;
}) {
  const t = useTranslations("MunicipalReport");
  const textColor = nested ? "text-[#4A4748]" : "text-[#292829]";

  return (
    <a
      href={`#${anchorId}`}
      onClick={(event) => handleAnchorClick(event, anchorId)}
      aria-label={t("document.goToSection", { title })}
      className="-mx-2 flex items-end gap-3 rounded-lg px-2 py-1.5 transition hover:bg-[#F3F4EC] print:mx-0 print:px-0"
    >
      <span className="flex min-w-0 flex-col">
        <span className={`font-inter text-[0.8125rem] leading-5 ${textColor}`}>
          {title}
        </span>
        {detail && (
          <span className="font-inter text-[0.6875rem] leading-4 text-[#8A8587]">
            {detail}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={`min-w-6 flex-1 border-b border-dotted border-[#C8CAC5] ${detail ? "mb-[21px]" : "mb-[5px]"}`}
      />
      {/* Na tela, o número da página do PDF não diz nada: uma seta indica que
          a linha leva até a seção. O número só aparece na impressão — e na
          medição, que emula as regras de impressão. */}
      <span
        className={`font-inter flex w-7 shrink-0 justify-end text-[0.8125rem] leading-5 tabular-nums text-[#6E696B] ${detail ? "mb-4" : ""}`}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className="size-4 self-center print:hidden"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path
            d="M4.5 10H15.5M11 5.5L15.5 10L11 14.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="hidden print:inline">{page}</span>
      </span>
    </a>
  );
}

export function ReportSummary<T extends ReportSummaryItem>({
  analyses,
  translateTitle,
  pages,
}: {
  analyses: readonly T[];
  translateTitle: (analysis: T) => string;
  /**
   * A página do PDF em que cada seção começa, pelo id da âncora. Fica vazia
   * até a medição terminar; a coluna do número tem largura fixa para que
   * preenchê-la não mude a altura do sumário — e, com ela, as próprias páginas.
   */
  pages?: ReadonlyMap<string, number> | null;
}) {
  const t = useTranslations("MunicipalReport");
  const tModules = useTranslations("ModulesContext");
  const groups = groupReportAnalysesByCategory(analyses);

  if (groups.length === 0) return null;

  const title = t("document.summaryTitle");

  return (
    <nav className="report-summary flex flex-col gap-6" aria-label={title}>
      <h2 className="font-open-sans text-[1.75rem] font-bold leading-[1.25] text-[#292829]">
        {title}
      </h2>
      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        {splitIntoColumns(groups).map((column, columnIndex) => (
          <div key={columnIndex} className="flex min-w-0 flex-col gap-8">
            {column.map((group) => (
              <section key={group.key} className="flex min-w-0 flex-col gap-2">
                <h3 className="report-heading font-inter border-b-2 border-[#646B2D] pb-2 text-xs font-semibold uppercase leading-5 tracking-[0.08em] text-[#5B612A]">
                  {tModules(`categories.${group.key}`)}
                </h3>
                <ul className="flex flex-col">
                  {group.analyses.map((analysis) => {
                    const entryTitle = translateTitle(analysis);
                    const anchorId = reportAnalysisAnchorId(analysis.alias);

                    return (
                      <li key={analysis.id} className="report-summary-entry">
                        <ReportSummaryLink
                          anchorId={anchorId}
                          title={entryTitle}
                          page={pages?.get(anchorId)}
                        />
                        {analysis.entries && (
                          <ul className="flex flex-col pl-4">
                            {analysis.entries.map((entry) => {
                              const entryAnchorId = reportAnalysisAnchorId(
                                entry.alias,
                              );

                              return (
                                <li
                                  key={entry.alias}
                                  className="report-summary-entry"
                                >
                                  <ReportSummaryLink
                                    anchorId={entryAnchorId}
                                    title={entry.title}
                                    detail={entry.detail}
                                    page={pages?.get(entryAnchorId)}
                                    nested
                                  />
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ))}
      </div>
    </nav>
  );
}
