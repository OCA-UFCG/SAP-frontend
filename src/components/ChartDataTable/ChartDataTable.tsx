"use client";

import { useId, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  describeChartSummary,
  summarizeChartRows,
  type ChartTableRow,
  type ChartTableSeries,
} from "@/utils/chartAccessibility";

interface ChartDataTableProps {
  /** O que a tabela mostra; vira o `<caption>`. */
  caption: string;
  series: ChartTableSeries[];
  rows: ChartTableRow[];
  formatValue: (value: number) => string;
}

/**
 * Os mesmos números do gráfico ao lado, numa tabela que o leitor de tela
 * percorre célula a célula. Fica recolhida atrás de um botão para não dobrar o
 * tamanho da página de quem lê o desenho.
 *
 * Só monta a tabela quando aberta: a série decendial do CDI tem quase mil
 * períodos, e milhares de células escondidas pesariam em toda renderização.
 *
 * @example
 * <ChartDataTable caption="Seca no Brasil" series={series} rows={rows}
 *   formatValue={(value) => `${value}%`} />
 */
export function ChartDataTable({
  caption,
  series,
  rows,
  formatValue,
}: ChartDataTableProps) {
  const t = useTranslations("ChartAccessibility");
  const tableId = useId();
  const [open, setOpen] = useState(false);

  if (rows.length === 0 || series.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={tableId}
        onClick={() => setOpen((current) => !current)}
        className="w-fit cursor-pointer rounded text-xs font-semibold text-[#5B612A] underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#5B612A]"
      >
        {open ? t("hideTable") : t("showTable")}
      </button>
      <div id={tableId} hidden={!open} className="max-h-80 overflow-auto">
        {open && (
          <table className="w-full border-collapse text-left text-xs text-[#292829]">
            <caption className="pb-1 text-left font-semibold">
              {caption}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="border-b border-[#E4E5E2] p-1.5">
                  {t("period")}
                </th>
                {series.map((item) => (
                  <th
                    key={item.id}
                    scope="col"
                    className="border-b border-[#E4E5E2] p-1.5"
                  >
                    {item.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.period}>
                  <th
                    scope="row"
                    className="border-b border-[#EFEFEF] p-1.5 font-normal"
                  >
                    {row.label}
                  </th>
                  {series.map((item) => {
                    const value = row.values[item.id];
                    return (
                      <td
                        key={item.id}
                        className="border-b border-[#EFEFEF] p-1.5 tabular-nums"
                      >
                        {typeof value === "number"
                          ? formatValue(value)
                          : t("noValue")}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/**
 * O resumo em frases da série, no idioma da página.
 *
 * @example
 * const text = useChartSummaryText(rows, series, (value) => `${value}%`);
 */
export function useChartSummaryText(
  rows: ChartTableRow[],
  series: ChartTableSeries[],
  formatValue: (value: number) => string,
): string {
  const t = useTranslations("ChartAccessibility");
  return useMemo(
    () =>
      describeChartSummary(
        summarizeChartRows(rows, series),
        (key, values) => t(key, values),
        formatValue,
      ),
    [rows, series, formatValue, t],
  );
}

/**
 * A descrição do gráfico para o leitor de tela, ligada ao desenho por
 * `aria-describedby`. Invisível na tela: a mesma informação já está à vista no
 * próprio gráfico.
 */
export function ChartDescription({ id, text }: { id: string; text: string }) {
  if (!text) return null;
  return (
    <p id={id} className="sr-only">
      {text}
    </p>
  );
}
