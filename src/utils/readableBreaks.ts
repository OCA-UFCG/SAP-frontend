/** Três dígitos significativos: o bastante para separar 1.050 de 1.040. */
export const READABLE_SIGNIFICANT_DIGITS = 3;

/**
 * Arredonda um limite para um número que alguém leria em voz alta.
 *
 * Um quantil cru sai como 1.046,3178 e vira rótulo de legenda. O arredondamento
 * é pela ordem de grandeza do próprio limite, e não pela do intervalo inteiro:
 * num indicador municipal torto o maior valor é milhares de vezes o mediano, e
 * arredondar os quatro limites pela escala do maior deles colapsaria os três
 * primeiros em zero.
 *
 * @example
 * roundToReadableBreak(1046.3178); // 1050
 */
export function roundToReadableBreak(
  value: number,
  significantDigits = READABLE_SIGNIFICANT_DIGITS,
) {
  if (!Number.isFinite(value) || value === 0) return value;
  const magnitude = Math.floor(Math.log10(Math.abs(value)));
  const unit = 10 ** (magnitude - (significantDigits - 1));
  return Number((Math.round(value / unit) * unit).toPrecision(15));
}

/**
 * Limites estritamente crescentes: dois iguais pintariam uma faixa que nenhum
 * município pode ocupar, e a legenda mostraria uma cor que não existe no mapa.
 */
export function keepIncreasing(breaks: readonly number[]) {
  return breaks.filter(
    (value, position) => position === 0 || value > breaks[position - 1],
  );
}

export function isStrictlyIncreasing(breaks: readonly number[]) {
  return breaks.every(
    (value, position) => position === 0 || value > breaks[position - 1],
  );
}
