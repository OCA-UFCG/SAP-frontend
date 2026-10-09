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

/**
 * As duas colunas do sumário, sem partir uma categoria ao meio: a esquerda
 * recebe categorias até ter pelo menos metade das entradas, e o resto empilha à
 * direita. No relatório típico, com muitos índices climáticos, isso dá o
 * desenho do design: climáticos à esquerda, ambientais e socioeconômicos à
 * direita.
 */
function splitIntoColumns(groups: readonly ReportCategoryGroup[]) {
  const total = groups.reduce((sum, group) => sum + group.analyses.length, 0);
  let leftCount = 0;
  let leftGroups = 0;

  while (
    leftGroups < groups.length &&
    (leftGroups === 0 || leftCount < total / 2)
  ) {
    leftCount += groups[leftGroups].analyses.length;
    leftGroups += 1;
  }

  return [groups.slice(0, leftGroups), groups.slice(leftGroups)];
}

export function ReportSummary({
  analyses,
  translateTitle,
  pages,
}: {
  analyses: readonly MunicipalReportAnalysis[];
  translateTitle: (analysis: MunicipalReportAnalysis) => string;
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
      <h2 className="font-open-sans text-[28px] font-bold leading-[1.25] text-[#292829]">
        {title}
      </h2>
      <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        {splitIntoColumns(groups).map((column, columnIndex) => (
          <div key={columnIndex} className="flex min-w-0 flex-col gap-8">
            {column.map((group) => (
              <section key={group.key} className="flex min-w-0 flex-col gap-2">
                <h3 className="report-heading font-inter border-b-2 border-[#989F43] pb-2 text-xs font-semibold uppercase leading-5 tracking-[0.08em] text-[#777E32]">
                  {tModules(`categories.${group.key}`)}
                </h3>
                <ul className="flex flex-col">
                  {group.analyses.map((analysis) => {
                    const entryTitle = translateTitle(analysis);
                    const anchorId = reportAnalysisAnchorId(analysis.alias);

                    return (
                      <li key={analysis.id} className="report-summary-entry">
                        <a
                          href={`#${anchorId}`}
                          onClick={(event) =>
                            handleAnchorClick(event, anchorId)
                          }
                          aria-label={t("document.goToSection", {
                            title: entryTitle,
                          })}
                          className="-mx-2 flex items-end gap-3 rounded-lg px-2 py-1.5 transition hover:bg-[#F3F4EC] print:mx-0 print:px-0"
                        >
                          <span className="font-inter min-w-0 text-[13px] leading-5 text-[#292829]">
                            {entryTitle}
                          </span>
                          <span
                            aria-hidden="true"
                            className="mb-[5px] min-w-6 flex-1 border-b border-dotted border-[#C8CAC5]"
                          />
                          <span className="font-inter w-7 shrink-0 text-right text-[13px] leading-5 tabular-nums text-[#7E797B]">
                            {pages?.get(anchorId)}
                          </span>
                        </a>
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
