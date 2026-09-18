"use client";

import type { MunicipalReportAnalysis } from "@/contracts/municipalReport";
import { formatMunicipalReportValue } from "@/utils/municipalReportValue";

const ZERO_BAR_WIDTH = "2px";

export function MunicipalReportClassBars({
  analysis,
  locale,
  translateLabel,
}: {
  analysis: MunicipalReportAnalysis;
  locale: string;
  translateLabel: (label: string) => string;
}) {
  const distribution = analysis.snapshot?.distribution ?? [];
  if (distribution.length === 0) return null;

  const scaleMax =
    analysis.valueType === "percentage"
      ? 100
      : Math.max(1, ...distribution.map((item) => item.percentage));

  return (
    <table className="report-class-bars font-open-sans w-full border-collapse border-spacing-0 text-xs text-[#292829]">
      <caption className="sr-only">
        {analysis.title} —{" "}
        {analysis.snapshot?.label ?? analysis.requestedPeriod}
      </caption>
      <tbody>
        {distribution.map((item) => {
          // A trilha abaixo já exclui o rótulo do valor, então a barra pode
          // ocupar a largura cheia sem empurrar a porcentagem para fora.
          const share = Math.max(0, (item.percentage / scaleMax) * 100);

          return (
            <tr key={item.id} className="report-class-bar-row align-middle">
              {/* `min-w` além de `w`: a célula da barra ocupa o resto da
                  largura, e sem o mínimo a tabela espremia o rótulo até a
                  largura da palavra mais longa. */}
              <th
                scope="row"
                className="w-[117px] min-w-[117px] py-1 pr-2 text-left align-middle font-normal leading-normal"
              >
                {translateLabel(item.label)}
              </th>
              <td className="py-1 align-middle">
                <span className="flex items-center gap-3">
                  <span className="flex min-w-0 flex-1">
                    <span
                      data-report-class-bar
                      className="block h-6 shrink-0 border border-black/10"
                      style={{
                        width: `${Number(share.toFixed(4))}%`,
                        minWidth: ZERO_BAR_WIDTH,
                        backgroundColor: item.color,
                      }}
                    />
                  </span>
                  <span className="shrink-0 whitespace-nowrap tabular-nums">
                    {formatMunicipalReportValue(
                      item.percentage,
                      analysis,
                      locale,
                    )}
                  </span>
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
