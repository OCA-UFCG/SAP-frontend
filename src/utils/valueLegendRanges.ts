import type {
  ClassMapping,
  MunicipalValueIndicator,
} from "@/types/indexCatalog";
import { formatMunicipalReportValue } from "@/utils/municipalReportValue";
import { buildSequentialColorRamp } from "@/utils/sequentialColorRamp";

/**
 * Quantas faixas o bloco de faixas sugere num índice que ainda não tem legenda.
 *
 * Cinco é o que a legenda do painel mostra sem virar uma lista, e era a
 * quantidade fixa do antigo botão "Detectar faixas da planilha".
 */
export const DEFAULT_RANGE_COUNT = 5;

function buildRangeLabels(
  thresholds: readonly number[],
  indicator: MunicipalValueIndicator,
) {
  const format = (value: number) =>
    formatMunicipalReportValue(
      value,
      { unit: indicator.measurementUnit, valueType: indicator.valueType },
      "pt-BR",
    );

  return [
    `menos de ${format(thresholds[0])}`,
    ...thresholds
      .slice(1)
      .map(
        (value, position) =>
          `${format(thresholds[position])} a ${format(value)}`,
      ),
    `${format(thresholds.at(-1) as number)} ou mais`,
  ];
}

/**
 * As faixas com rótulo e cor para uma lista de limites.
 *
 * É o que o bloco "Faixas de cor do mapa" escreve quando o operador aplica os
 * limites de um método de classificação: um limite calculado vira uma linha de
 * legenda com rótulo legível e um tom da cor do indicador, e o operador corrige
 * o que quiser em cima disso.
 *
 * @example
 * buildValueLegendRanges([6, 12], indicator)[0].label; // "menos de 6"
 */
export function buildValueLegendRanges(
  thresholds: readonly number[],
  indicator: MunicipalValueIndicator,
): ClassMapping[] {
  const labels = buildRangeLabels(thresholds, indicator);
  const colors = buildSequentialColorRamp(indicator.color, labels.length);
  return labels.map((label, position) => ({
    classIndex: position,
    pixelValue: position,
    id: `faixa-${position + 1}`,
    label,
    color: colors[position],
  }));
}
