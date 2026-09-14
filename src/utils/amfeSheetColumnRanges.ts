/**
 * As faixas sugeridas para a coluna de uma planilha: limites de intervalos
 * iguais entre o menor e o maior valor municipal, com rótulo e cor prontos.
 *
 * O catálogo escreve o resultado nos mesmos campos que o operador preencheria à
 * mão, e ele continua podendo editar tudo antes de validar — a sugestão é um
 * ponto de partida, não um modo de operação diferente.
 */

/** Paleta sequencial padrão do catálogo, do valor menor para o maior. */
const SUGGESTED_RANGE_COLORS = [
  "#FFFFCC",
  "#FFEDA0",
  "#FED976",
  "#FEB24C",
  "#FD8D3C",
  "#FC4E2A",
  "#E31A1C",
  "#BD0026",
];

export const MIN_SUGGESTED_RANGE_COUNT = 2;
export const MAX_SUGGESTED_RANGE_COUNT = SUGGESTED_RANGE_COLORS.length;

export interface SuggestedColumnRange {
  id: string;
  label: string;
  color: string;
}

export interface SuggestedColumnClassification {
  min: number;
  max: number;
  thresholds: number[];
  ranges: SuggestedColumnRange[];
}

/**
 * Casas decimais proporcionais à amplitude da coluna. Um índice que varia de 0
 * a 1 precisa de três casas para os limites não colidirem; uma contagem de
 * cisternas que vai a milhares fica ilegível com qualquer casa decimal.
 */
function resolveDecimals(range: number): number {
  if (range >= 100) return 0;
  if (range >= 10) return 1;
  if (range >= 1) return 2;
  return 4;
}

function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function formatRangeValue(value: number, decimals: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Os limites que dividem `[min, max]` em `classCount` intervalos iguais.
 *
 * Arredondar os limites é o que os torna legíveis na legenda, mas pode colar
 * dois limites no mesmo número numa coluna de amplitude minúscula — nesse caso
 * a lista arredondada é descartada e valem os limites exatos, porque uma faixa
 * vazia pintaria uma cor que nenhum município tem.
 */
export function buildEqualIntervalThresholds(
  min: number,
  max: number,
  classCount: number,
): number[] {
  const step = (max - min) / classCount;
  const exact = Array.from(
    { length: classCount - 1 },
    (_value, index) => min + step * (index + 1),
  );
  const decimals = resolveDecimals(max - min);
  const rounded = exact.map((value) => roundTo(value, decimals));

  return new Set(rounded).size === rounded.length ? rounded : exact;
}

function buildRangeLabel(
  thresholds: readonly number[],
  position: number,
  decimals: number,
  unit: string,
): string {
  const suffix = unit ? ` ${unit}` : "";
  const format = (value: number) =>
    `${formatRangeValue(value, decimals)}${suffix}`;

  if (position === 0) return `Até ${format(thresholds[0])}`;
  if (position === thresholds.length) {
    return `Acima de ${format(thresholds[thresholds.length - 1])}`;
  }
  return `${format(thresholds[position - 1])} a ${format(thresholds[position])}`;
}

/**
 * A classificação sugerida para uma coluna, a partir dos valores municipais.
 *
 * @example
 * suggestColumnClassification([0, 25, 50, 75, 100], 4, "%");
 * // { min: 0, max: 100, thresholds: [25, 50, 75], ranges: [{ label: "Até 25 %", … }, …] }
 */
export function suggestColumnClassification(
  values: readonly number[],
  classCount: number,
  unit: string,
): SuggestedColumnClassification {
  if (values.length === 0) {
    throw new Error("A coluna escolhida não tem nenhum valor numérico.");
  }
  if (
    !Number.isInteger(classCount) ||
    classCount < MIN_SUGGESTED_RANGE_COUNT ||
    classCount > MAX_SUGGESTED_RANGE_COUNT
  ) {
    throw new Error(
      `A quantidade de faixas deve ser um número inteiro entre ${MIN_SUGGESTED_RANGE_COUNT} e ${MAX_SUGGESTED_RANGE_COUNT}; recebido: ${classCount}.`,
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    throw new Error(
      `Todos os municípios têm o mesmo valor (${min}) nesta coluna; não há intervalo para dividir em faixas.`,
    );
  }

  const thresholds = buildEqualIntervalThresholds(min, max, classCount);
  const decimals = resolveDecimals(max - min);
  // A paleta é percorrida de ponta a ponta qualquer que seja a quantidade de
  // faixas: com quatro faixas as cores saem da primeira, de duas do meio e da
  // última, em vez de as quatro primeiras — que seriam quase o mesmo amarelo.
  const colorStep = (SUGGESTED_RANGE_COLORS.length - 1) / (classCount - 1);

  return {
    min,
    max,
    thresholds,
    ranges: Array.from({ length: classCount }, (_value, position) => ({
      id: `faixa-${position + 1}`,
      label: buildRangeLabel(thresholds, position, decimals, unit),
      color: SUGGESTED_RANGE_COLORS[Math.round(position * colorStep)],
    })),
  };
}
