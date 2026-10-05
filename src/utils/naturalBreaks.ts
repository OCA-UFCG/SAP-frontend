/**
 * Quebras naturais de Jenks: os limites que deixam cada faixa o mais homogênea
 * possível e as faixas o mais diferentes possível entre si.
 *
 * É o algoritmo clássico de programação dinâmica, o mesmo que o ArcGIS chama de
 * "Natural Breaks (Jenks)". O custo é proporcional ao quadrado do número de
 * valores, e é por isso que quem chama entrega uma amostra reduzida
 * (`buildClassificationSample`) e não a distribuição inteira.
 *
 * O resultado depende do conjunto de dados: dois índices classificados assim
 * não são comparáveis lado a lado, e a tela do catálogo diz isso ao operador.
 *
 * @example
 * findNaturalBreaks([1, 2, 3, 10, 11, 12], 2); // [10]
 */
export function findNaturalBreaks(sortedValues: number[], classCount: number) {
  const total = sortedValues.length;
  if (classCount < 2 || total < classCount) return [];

  const { lowerClassLimits } = buildJenksMatrices(sortedValues, classCount);

  const breaks: number[] = [];
  let upperBound = total;
  for (let currentClass = classCount; currentClass > 1; currentClass -= 1) {
    const limitIndex = lowerClassLimits[upperBound][currentClass] - 1;
    breaks.unshift(sortedValues[limitIndex]);
    upperBound = limitIndex;
  }
  return breaks;
}

/**
 * As duas matrizes do Jenks: onde cada classe começa (`lowerClassLimits`) e a
 * soma dos desvios quadrados acumulada até ali (`varianceCombinations`).
 *
 * Os índices são deslocados em um porque o algoritmo original é escrito em base
 * 1; manter o deslocamento evita traduzir a recorrência e errar um limite.
 */
function buildJenksMatrices(sortedValues: number[], classCount: number) {
  const total = sortedValues.length;
  const lowerClassLimits: number[][] = [];
  const varianceCombinations: number[][] = [];

  for (let row = 0; row <= total; row += 1) {
    lowerClassLimits.push(new Array<number>(classCount + 1).fill(0));
    varianceCombinations.push(
      new Array<number>(classCount + 1).fill(row === 0 ? 0 : Infinity),
    );
  }
  for (let currentClass = 1; currentClass <= classCount; currentClass += 1) {
    lowerClassLimits[1][currentClass] = 1;
    varianceCombinations[1][currentClass] = 0;
  }

  for (let element = 2; element <= total; element += 1) {
    let sum = 0;
    let sumOfSquares = 0;
    let count = 0;

    for (let offset = 1; offset <= element; offset += 1) {
      const lowerIndex = element - offset + 1;
      const value = sortedValues[lowerIndex - 1];
      count += 1;
      sum += value;
      sumOfSquares += value * value;
      const variance = sumOfSquares - (sum * sum) / count;
      if (lowerIndex === 1) {
        lowerClassLimits[element][1] = 1;
        varianceCombinations[element][1] = variance;
        continue;
      }
      for (
        let currentClass = 2;
        currentClass <= classCount;
        currentClass += 1
      ) {
        const candidate =
          variance + varianceCombinations[lowerIndex - 1][currentClass - 1];
        if (varianceCombinations[element][currentClass] >= candidate) {
          lowerClassLimits[element][currentClass] = lowerIndex;
          varianceCombinations[element][currentClass] = candidate;
        }
      }
    }
  }

  return { lowerClassLimits, varianceCombinations };
}
