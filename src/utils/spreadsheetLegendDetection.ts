import type {
  ClassMapping,
  MunicipalValueIndicator,
} from "@/types/indexCatalog";
import { formatMunicipalReportValue } from "@/utils/municipalReportValue";
import { buildSequentialColorRamp } from "@/utils/sequentialColorRamp";

/** Cinco faixas é o que a legenda do painel mostra sem virar uma lista. */
export const DEFAULT_DETECTED_RANGE_COUNT = 5;

export type DetectedLegendMethod = "quantile" | "interval";

export interface DetectedValueLegend {
  /** Um a menos que as faixas, em ordem crescente, na unidade do indicador. */
  thresholds: number[];
  ranges: ClassMapping[];
  method: DetectedLegendMethod;
  /** Municípios com valor no período; os sem dado não entram no cálculo. */
  sampleCount: number;
  /** Menor que o pedido quando os valores não separam tantas faixas. */
  rangeCount: number;
}

/** Três dígitos significativos: o bastante para separar 1.050 de 1.040. */
const READABLE_SIGNIFICANT_DIGITS = 3;

/**
 * Arredonda um limite para um número que alguém leria em voz alta.
 *
 * Um quantil cru sai como 1.046,3178 e vira rótulo de legenda. O
 * arredondamento é pela ordem de grandeza do próprio limite, e não pela do
 * intervalo inteiro: num indicador municipal torto o maior valor é milhares de
 * vezes o mediano, e arredondar os quatro limites pela escala do maior deles
 * colapsaria os três primeiros em zero.
 */
function roundToReadableBreak(value: number) {
  if (!Number.isFinite(value) || value === 0) return value;
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const unit = 10 ** (magnitude - (READABLE_SIGNIFICANT_DIGITS - 1));
  return Number((Math.round(value / unit) * unit).toPrecision(15));
}

/**
 * Os limites que deixam mais ou menos o mesmo número de municípios em cada
 * faixa.
 *
 * É o corte que funciona nos dados territoriais brasileiros: quase todo
 * indicador municipal é torto — poucos municípios enormes e milhares
 * pequenos —, e dividir o intervalo em partes iguais joga 95% do país na
 * primeira cor.
 */
function quantileBreaks(sorted: readonly number[], rangeCount: number) {
  return Array.from({ length: rangeCount - 1 }, (_entry, position) => {
    const rank = Math.floor(((position + 1) * sorted.length) / rangeCount);
    return sorted[Math.min(rank, sorted.length - 1)];
  });
}

/** O corte de reserva, para quando os quantis colapsam em valores repetidos. */
function intervalBreaks(minimum: number, maximum: number, rangeCount: number) {
  const step = (maximum - minimum) / rangeCount;
  return Array.from(
    { length: rangeCount - 1 },
    (_entry, position) => minimum + step * (position + 1),
  );
}

/**
 * Limites estritamente crescentes: dois iguais pintariam uma faixa que nenhum
 * município pode ocupar, e a legenda mostraria uma cor que não existe no mapa.
 */
function keepIncreasing(breaks: readonly number[]) {
  return breaks.filter(
    (value, position) => position === 0 || value > breaks[position - 1],
  );
}

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

function buildRanges(
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

/**
 * As faixas de cor de um índice de planilha, deduzidas dos próprios valores.
 *
 * O catálogo já sabe o que a planilha contém quando o operador cola o link, e
 * pedir a ele os limites e os rótulos de cinco faixas era pedir que
 * adivinhasse a distribuição de um dado que o sistema tem em mãos. Nada aqui
 * fica gravado: a detecção preenche o formulário, e o que vale continua sendo
 * o que ele deixar na tela antes de validar.
 *
 * @example
 * detectValueLegend([1, 2, 3, 40, 500], indicator, 3).thresholds; // [3, 40]
 */
export function detectValueLegend(
  values: readonly number[],
  indicator: MunicipalValueIndicator,
  requestedRangeCount = DEFAULT_DETECTED_RANGE_COUNT,
): DetectedValueLegend {
  const sorted = values
    .filter(Number.isFinite)
    .sort((left, right) => left - right);
  const distinct = new Set(sorted).size;
  if (distinct < 2) {
    throw new Error(
      `A planilha tem ${distinct} valor(es) distinto(s) no período lido: não há como separar faixas de cor. Confira o prefixo das colunas de dado.`,
    );
  }

  const rangeCount = Math.min(requestedRangeCount, distinct);
  const rounded = (breaks: readonly number[]) =>
    keepIncreasing(breaks.map(roundToReadableBreak));

  const byQuantile = rounded(quantileBreaks(sorted, rangeCount));
  const method: DetectedLegendMethod =
    byQuantile.length === rangeCount - 1 ? "quantile" : "interval";
  const thresholds =
    method === "quantile"
      ? byQuantile
      : rounded(intervalBreaks(sorted[0], sorted.at(-1) as number, rangeCount));

  if (thresholds.length === 0) {
    throw new Error(
      `Os valores do período lido estão concentrados demais para virar faixas (${sorted[0]} a ${sorted.at(-1)}): escreva os limites à mão.`,
    );
  }

  return {
    thresholds,
    ranges: buildRanges(thresholds, indicator),
    method,
    sampleCount: sorted.length,
    rangeCount: thresholds.length + 1,
  };
}
