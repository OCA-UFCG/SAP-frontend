import type {
  CompactAnalysisClass,
  CompactAnalysisYearData,
} from "@/utils/analysis";
import type { ChartTableRow } from "@/utils/chartAccessibility";
import { roundToDisplayedDecimals } from "@/utils/formatTerritorialNumber";

/**
 * Os dados do gráfico de Visão temporal, fora do componente para que a tabela
 * alternativa e as linhas do amCharts saiam da mesma conta.
 */

export function sortYearEntries(
  years: Record<string, CompactAnalysisYearData>,
) {
  return Object.entries(years).sort(([left], [right]) =>
    left.localeCompare(right),
  );
}

/** A chave de tradução do rótulo vem do próprio texto do Contentful. */
export function toClassLabelSlug(label: string) {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/</g, "menor-que")
    .replace(/>/g, "maior-que")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

/**
 * A série do gráfico como linhas de tabela, um período por linha e uma classe
 * por coluna — a alternativa em texto ao desenho do amCharts.
 *
 * @example
 * buildTemporalTableRows(years, classes, "pb");
 * // [{ period: "2023", label: "2023", values: { "0": 12.5, "1": 87.5 } }]
 */
export function buildTemporalTableRows(
  years: Record<string, CompactAnalysisYearData>,
  classes: CompactAnalysisClass[],
  selectedState: string,
): ChartTableRow[] {
  const sortedYearEntries = sortYearEntries(years);
  const seriesByClass = classes.map((_cls, classIndex) =>
    buildSeriesData(sortedYearEntries, selectedState, classIndex),
  );
  return sortedYearEntries.map(([yearKey, yearData], rowIndex) => {
    const period = String(yearData.year ?? yearKey);
    return {
      period,
      label: period,
      values: Object.fromEntries(
        classes.map((_cls, classIndex) => [
          String(classIndex),
          seriesByClass[classIndex][rowIndex]?.value ?? null,
        ]),
      ),
    };
  });
}

export function buildSeriesData(
  sortedYearEntries: Array<[string, CompactAnalysisYearData]>,
  selectedState: string,
  classIndex: number,
) {
  return sortedYearEntries.map(([yearKey, yearData]) => {
    const locationValues = yearData.values[selectedState];
    const scale = yearData.valuesScale ?? 1;
    const rawValue = locationValues?.[classIndex];

    return {
      year: yearData.year ?? yearKey,
      value:
        typeof rawValue === "number"
          ? roundToDisplayedDecimals(rawValue / scale)
          : null,
    };
  });
}
