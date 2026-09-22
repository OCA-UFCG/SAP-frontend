import type { ClassificationSample } from "@/utils/classificationSample";
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
  const thresholds = roundBreaks(raw, sample);
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

function requireClassCount({ classCount, method }: ClassBreaksRequest) {
  if (!Number.isInteger(classCount) || classCount < 2 || classCount > 24) {
    throw new Error(
      `Quantidade de faixas inválida para ${method}: ${classCount}. Informe um inteiro entre 2 e 24.`,
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
 * Arredonda os limites para um número de casas que o operador consiga escrever
 * na legenda, sem colar dois limites no mesmo valor.
 *
 * Um limite de `23,847291953` vira uma linha de legenda ilegível, mas arredondar
 * cedo demais transforma dois limites vizinhos num só e a validação do catálogo
 * recusa a gravação ("Informe exatamente N limites"). Por isso a precisão sobe
 * até os limites voltarem a ser estritamente crescentes, e o valor cru é
 * devolvido quando nem seis casas resolvem.
 */
function roundBreaks(breaks: number[], sample: ClassificationSample) {
  const magnitude = Math.log10((sample.max - sample.min) / breaks.length || 1);
  const start = Math.min(6, Math.max(0, 2 - Math.floor(magnitude)));
  for (let decimals = start; decimals <= 6; decimals += 1) {
    const rounded = breaks.map(
      (edge) => Math.round(edge * 10 ** decimals) / 10 ** decimals,
    );
    if (isStrictlyIncreasing(rounded)) return rounded;
  }
  return breaks;
}

function isStrictlyIncreasing(values: number[]) {
  return values.every(
    (value, index) => index === 0 || value > values[index - 1],
  );
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(4);
}
