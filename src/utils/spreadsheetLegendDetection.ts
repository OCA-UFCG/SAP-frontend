import type {
  ClassMapping,
  MunicipalValueIndicator,
} from "@/types/indexCatalog";
import { computeClassBreaks } from "@/utils/classificationBreaks";
import { buildClassificationSample } from "@/utils/classificationSample";
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
  /** Menor que o pedido quando a planilha tem menos valores distintos. */
  rangeCount: number;
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

/**
 * As faixas com rótulo e cor para uma lista de limites.
 *
 * Exportada porque o bloco de métodos de classificação do catálogo aplica os
 * limites que calculou pelos mesmos rótulos e pela mesma rampa de cor: os dois
 * caminhos preenchem a mesma legenda, e duas convenções de rótulo deixariam o
 * índice com "menos de 6" numa faixa e "0 a 6" na outra.
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
  const sample = buildClassificationSample([...sorted]);
  if (!sample) {
    throw new Error(
      `A planilha não trouxe nenhum valor numérico no período lido (${values.length} célula(s)).`,
    );
  }

  /**
   * O quantil é o corte que funciona nos dados territoriais brasileiros: quase
   * todo indicador municipal é torto — poucos municípios enormes e milhares
   * pequenos —, e dividir o intervalo em partes iguais joga 95% do país na
   * primeira cor. Ele só é recusado quando os valores empatam demais para
   * separar tantas faixas, e aí o intervalo igual é a reserva.
   */
  const byQuantile = tryBreaks(sample, "quantile", rangeCount);
  const method: DetectedLegendMethod = byQuantile ? "quantile" : "interval";
  const thresholds =
    byQuantile ?? tryBreaks(sample, "equalInterval", rangeCount);

  if (!thresholds) {
    throw new Error(
      `Os valores do período lido estão concentrados demais para virar faixas (${sorted[0]} a ${sorted.at(-1)}): escreva os limites à mão.`,
    );
  }

  return {
    thresholds,
    ranges: buildValueLegendRanges(thresholds, indicator),
    method,
    sampleCount: sorted.length,
    rangeCount: thresholds.length + 1,
  };
}

/**
 * Os limites de um método, ou `null` quando ele não consegue separar tantas
 * faixas neste dado. A detecção escolhe o corte pela tentativa, então a recusa
 * do método é um resultado esperado e não um erro a propagar.
 */
function tryBreaks(
  sample: NonNullable<ReturnType<typeof buildClassificationSample>>,
  method: "quantile" | "equalInterval",
  rangeCount: number,
) {
  try {
    return computeClassBreaks(sample, { method, classCount: rangeCount })
      .thresholds;
  } catch {
    return null;
  }
}
