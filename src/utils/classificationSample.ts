/**
 * A distribuição de valores sobre a qual os métodos de classificação calculam
 * os limites das faixas.
 *
 * `values` já vem ordenada e pode ser uma **amostra** do conjunto inteiro: um
 * raster tem milhões de pixels e o Jenks é quadrático no tamanho da entrada.
 * Por isso `count`, `mean` e `standardDeviation` descrevem o conjunto completo
 * e são calculados antes do corte — usar a média da amostra reduzida daria um
 * desvio padrão sistematicamente menor que o real.
 */
export interface ClassificationSample {
  /** Valores finitos em ordem crescente, possivelmente reduzidos. */
  values: number[];
  /** Quantos valores finitos existiam antes da redução. */
  count: number;
  min: number;
  max: number;
  mean: number;
  standardDeviation: number;
}

/**
 * Quantos valores a amostra guarda depois de reduzida.
 *
 * O limite existe pelo Jenks, que compara cada valor com todos os outros: com
 * os 5.570 municípios do país a matriz passaria de 31 milhões de células a cada
 * clique em "Gerar limites". Mil valores mantêm o desenho da distribuição e
 * deixam o cálculo instantâneo.
 */
export const CLASSIFICATION_SAMPLE_LIMIT = 1000;

function pickEvenlySpaced(sorted: number[], limit: number) {
  if (sorted.length <= limit) return sorted;
  const reduced: number[] = [];
  for (let position = 0; position < limit; position += 1) {
    const index = Math.round((position * (sorted.length - 1)) / (limit - 1));
    reduced.push(sorted[index]);
  }
  return reduced;
}

/**
 * A amostra de classificação a partir de valores crus, ignorando nulos e
 * valores não finitos.
 *
 * @example
 * buildClassificationSample([3, null, 1, 2]); // min 1, max 3, count 3
 */
export function buildClassificationSample(
  rawValues: Array<number | null | undefined>,
): ClassificationSample | null {
  const finite = rawValues.filter(
    (value): value is number =>
      typeof value === "number" && Number.isFinite(value),
  );
  if (finite.length === 0) return null;

  const sorted = [...finite].sort((first, second) => first - second);
  const mean =
    finite.reduce((total, value) => total + value, 0) / finite.length;
  const variance =
    finite.reduce((total, value) => total + (value - mean) ** 2, 0) /
    finite.length;

  return {
    values: pickEvenlySpaced(sorted, CLASSIFICATION_SAMPLE_LIMIT),
    count: finite.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean,
    standardDeviation: Math.sqrt(variance),
  };
}
