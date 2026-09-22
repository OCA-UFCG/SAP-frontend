import type { ClassificationSample } from "@/utils/classificationSample";
import {
  isStrictlyIncreasing,
  READABLE_SIGNIFICANT_DIGITS,
  roundToReadableBreak,
} from "@/utils/readableBreaks";
import { findNaturalBreaks } from "@/utils/naturalBreaks";

/**
 * Os métodos de classificação que o catálogo oferece para calcular os limites
 * entre as faixas do mapa, com os mesmos nomes e a mesma matemática dos métodos
 * do ArcGIS Pro.
 *
 * `manual` não calcula nada: é o campo de limites escrito à mão, que continua
 * sendo o modo padrão e a saída de emergência de todos os outros.
 */
export const CLASSIFICATION_METHODS = [
  "manual",
  "equalInterval",
  "quantile",
  "naturalBreaks",
  "geometricalInterval",
  "definedInterval",
  "standardDeviation",
] as const;

export type ClassificationMethodId = (typeof CLASSIFICATION_METHODS)[number];

export interface ClassBreaksRequest {
  method: ClassificationMethodId;
  /**
   * Quantas faixas a legenda deve ter. Usado pelos métodos em que a quantidade
   * é uma escolha; ignorado por `definedInterval` e `standardDeviation`, em que
   * ela sai do dado.
   */
  classCount: number;
  /** Tamanho de cada faixa, na unidade do dado. Só `definedInterval`. */
  intervalSize?: number;
  /** Fração do desvio padrão por faixa. Só `standardDeviation`. */
  deviationInterval?: number;
}

export interface ClassBreaksResult {
  /** Limites em ordem crescente, um a menos que `classCount`. */
  thresholds: number[];
  /** Quantas faixas os limites produzem — pode diferir do que foi pedido. */
  classCount: number;
}

/**
 * Os limites entre as faixas, pelo método escolhido.
 *
 * A saída é a mesma lista que o campo "Limites entre as faixas" já aceitava
 * digitada: o método é uma ajuda para preencher o campo, e não um novo formato
 * gravado no Contentful.
 *
 * @example
 * computeClassBreaks(sample, { method: "quantile", classCount: 4 });
 * // { thresholds: [12, 25, 48], classCount: 4 }
 */
export function computeClassBreaks(
  sample: ClassificationSample,
  request: ClassBreaksRequest,
): ClassBreaksResult {
  assertUsableSample(sample);
  const raw = computeRawBreaks(sample, request);
  const thresholds = roundBreaks(raw);
  assertSeparableBreaks(thresholds, request);
  return { thresholds, classCount: thresholds.length + 1 };
}

function computeRawBreaks(
  sample: ClassificationSample,
  request: ClassBreaksRequest,
): number[] {
  switch (request.method) {
    case "equalInterval":
      return equalIntervalBreaks(sample, requireClassCount(request));
    case "quantile":
      return quantileBreaks(sample, requireClassCount(request));
    case "naturalBreaks":
      return findNaturalBreaks(sample.values, requireClassCount(request));
    case "geometricalInterval":
      return geometricalIntervalBreaks(sample, requireClassCount(request));
    case "definedInterval":
      return definedIntervalBreaks(sample, request.intervalSize);
    case "standardDeviation":
      return standardDeviationBreaks(sample, request.deviationInterval);
    default:
      throw new Error(
        `Método de classificação sem cálculo automático: ${request.method}. Use um de ${CLASSIFICATION_METHODS.slice(1).join(", ")}.`,
      );
  }
}

function assertUsableSample(sample: ClassificationSample) {
  if (sample.values.length === 0 || sample.max <= sample.min) {
    throw new Error(
      `Os valores lidos não variam (mínimo ${sample.min}, máximo ${sample.max}): não há como separar faixas automaticamente.`,
    );
  }
}

/**
 * Recusa limites repetidos.
 *
 * Acontece de verdade nos dados do semiárido: um índice em que a maioria dos
 * municípios vale zero faz o quantil pedir dois limites no mesmo zero. Gravar
 * isso passaria na validação do catálogo — a contagem de limites está certa —
 * e produziria uma faixa da legenda que nenhum município pode ocupar.
 */
function assertSeparableBreaks(
  thresholds: number[],
  request: ClassBreaksRequest,
) {
  if (isStrictlyIncreasing(thresholds)) return;
  throw new Error(
    `O método ${request.method} repetiu limites (${thresholds.join(", ")}): há valores demais empatados para separar ${thresholds.length + 1} faixas. Use menos faixas ou outro método.`,
  );
}

/**
 * O máximo de faixas que uma legenda aceita.
 *
 * Vale tanto para quem escolhe a quantidade quanto para `definedInterval`, em
 * que ela sai da largura informada: uma largura pequena demais para a amplitude
 * do asset produzia centenas de milhares de limites, calculados a cada tecla
 * digitada no campo. Ninguém publica uma legenda assim — é sempre um zero a
 * mais ou a vírgula no lugar errado —, e sem o teto a aba travava antes de a
 * pessoa terminar de digitar o número que queria.
 */
const MAX_CLASS_COUNT = 24;

function requireClassCount({ classCount, method }: ClassBreaksRequest) {
  if (
    !Number.isInteger(classCount) ||
    classCount < 2 ||
    classCount > MAX_CLASS_COUNT
  ) {
    throw new Error(
      `Quantidade de faixas inválida para ${method}: ${classCount}. Informe um inteiro entre 2 e ${MAX_CLASS_COUNT}.`,
    );
  }
  return classCount;
}

/** Faixas de mesma largura entre o menor e o maior valor. */
function equalIntervalBreaks(sample: ClassificationSample, classCount: number) {
  const step = (sample.max - sample.min) / classCount;
  return rangeOfBreaks(classCount).map(
    (position) => sample.min + step * position,
  );
}

/**
 * Faixas com a mesma quantidade de territórios em cada uma.
 *
 * Lê a amostra ordenada na posição proporcional: com 4 faixas, os limites são
 * os valores que deixam 25%, 50% e 75% dos territórios abaixo.
 */
function quantileBreaks(sample: ClassificationSample, classCount: number) {
  const { values } = sample;
  return rangeOfBreaks(classCount).map(
    (position) => values[Math.floor((position * values.length) / classCount)],
  );
}

/**
 * Faixas que crescem em progressão geométrica: estreitas perto do mínimo e
 * largas perto do máximo.
 *
 * É o método para um dado contínuo muito concentrado num extremo — chuva
 * acumulada, em que quase todo município fica perto de zero e a faixa igual
 * pintaria o país inteiro de uma cor só. A série só é definida sobre valores
 * positivos, então um dado com zero ou negativo (uma anomalia em °C) é
 * deslocado para começar em 1 e trazido de volta no fim.
 */
function geometricalIntervalBreaks(
  sample: ClassificationSample,
  classCount: number,
) {
  const offset = sample.min > 0 ? 0 : 1 - sample.min;
  const low = sample.min + offset;
  const ratio = (sample.max + offset) / low;
  return rangeOfBreaks(classCount).map(
    (position) => low * ratio ** (position / classCount) - offset,
  );
}

/**
 * Faixas de um tamanho escolhido pelo operador; a quantidade de faixas sai do
 * dado.
 *
 * O ArcGIS exige pelo menos três faixas, e a exigência é prática: um intervalo
 * maior que metade da amplitude produz um mapa de duas cores que não classifica
 * nada.
 */
function definedIntervalBreaks(
  sample: ClassificationSample,
  intervalSize: number | undefined,
) {
  if (!Number.isFinite(intervalSize) || (intervalSize ?? 0) <= 0) {
    throw new Error(
      `Tamanho da faixa inválido: ${intervalSize}. Informe um número maior que zero, na unidade do dado.`,
    );
  }
  const step = intervalSize as number;
  assertIntervalFitsLegend(sample, step);
  const breaks: number[] = [];
  for (let edge = sample.min + step; edge < sample.max; edge += step) {
    breaks.push(edge);
  }
  if (breaks.length < 2) {
    throw new Error(
      `Um intervalo de ${step} gera ${breaks.length + 1} faixa(s) entre ${sample.min} e ${sample.max}. Use um intervalo menor que ${formatNumber((sample.max - sample.min) / 2)} para chegar a três faixas.`,
    );
  }
  return breaks;
}

/**
 * Recusa uma largura de faixa pequena demais **antes** de montar os limites.
 *
 * A contagem é feita pela conta, e não pelo laço, porque o laço é justamente o
 * problema: uma largura de 1 num raster que vai de 0 a 1.000.000 montava um
 * milhão de limites em dois segundos, arredondava cada um deles e desenhava a
 * lista inteira na tela — a cada tecla, já que quem quer digitar "1000" digita
 * "1" primeiro.
 */
function assertIntervalFitsLegend(sample: ClassificationSample, step: number) {
  const amplitude = sample.max - sample.min;
  const wouldBeClasses = Math.ceil(amplitude / step);
  if (wouldBeClasses <= MAX_CLASS_COUNT) return;
  throw new Error(
    `Um intervalo de ${formatNumber(step)} gera ${formatNumber(wouldBeClasses)} faixas entre ${sample.min} e ${sample.max}, acima do máximo de ${MAX_CLASS_COUNT}. Use um intervalo de pelo menos ${formatNumber(amplitude / MAX_CLASS_COUNT)}.`,
  );
}

/**
 * Limites a uma proporção do desvio padrão de distância da média, para os dois
 * lados.
 *
 * A média é um limite, e não o centro de uma faixa: é o que faz a legenda ler
 * "abaixo da média" de um lado e "acima da média" do outro. A quantidade de
 * faixas sai de quantos desvios cabem entre o mínimo e o máximo.
 */
function standardDeviationBreaks(
  sample: ClassificationSample,
  deviationInterval: number | undefined,
) {
  const fraction = deviationInterval ?? 1;
  if (!Number.isFinite(fraction) || fraction <= 0) {
    throw new Error(
      `Proporção do desvio padrão inválida: ${deviationInterval}. Informe 1, 1/2, 1/3 ou 1/4.`,
    );
  }
  if (sample.standardDeviation <= 0) {
    throw new Error(
      `O desvio padrão dos valores lidos é ${sample.standardDeviation}: todos os territórios têm o mesmo valor e não há faixas a separar.`,
    );
  }
  const step = fraction * sample.standardDeviation;
  const breaks: number[] = [];
  for (let edge = sample.mean; edge > sample.min; edge -= step)
    breaks.unshift(edge);
  for (let edge = sample.mean + step; edge < sample.max; edge += step) {
    breaks.push(edge);
  }
  return breaks;
}

function rangeOfBreaks(classCount: number) {
  return Array.from({ length: classCount - 1 }, (_value, index) => index + 1);
}

/**
 * Arredonda os limites para números que caibam num rótulo de legenda, sem colar
 * dois limites no mesmo valor.
 *
 * Um limite de `23,847291953` vira uma linha de legenda ilegível, mas arredondar
 * demais transforma dois limites vizinhos num só e a validação do catálogo
 * recusa a gravação ("Informe exatamente N limites"). Por isso a precisão sobe
 * de três dígitos significativos em diante até os limites voltarem a ser
 * estritamente crescentes, e o valor cru é devolvido quando nem doze resolvem.
 */
function roundBreaks(breaks: number[]) {
  for (let digits = READABLE_SIGNIFICANT_DIGITS; digits <= 12; digits += 1) {
    const rounded = breaks.map((edge) => roundToReadableBreak(edge, digits));
    if (isStrictlyIncreasing(rounded)) return rounded;
  }
  return breaks;
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(4);
}
