/**
 * Formatação dos números territoriais mostrados ao usuário (painel, relatório,
 * legenda). Valores absolutos grandes, como o PIB, viravam uma fileira de
 * dígitos ("10.943.345.438.880") que ninguém lê de relance; a partir de um
 * milhão eles são abreviados. Decimais aparecem sempre com duas casas, para
 * não mostrar "12,0" ao lado de "12,35".
 *
 * @example
 * formatAbsoluteNumber(10_943_345_438_880, "pt-BR"); // "10,94 Tri"
 * formatAbsoluteNumber(2_500_000, "pt-BR"); // "2,50 Mi"
 * formatAbsoluteNumber(1234.5, "pt-BR"); // "1.234,50"
 */
const COMPACT_SCALES = [
  { divisor: 1e12, suffix: "Tri", englishSuffix: "T" },
  { divisor: 1e9, suffix: "Bi", englishSuffix: "B" },
  { divisor: 1e6, suffix: "Mi", englishSuffix: "M" },
] as const;

export const DECIMAL_FRACTION_DIGITS = 2;

export function formatDecimalNumber(value: number, locale: string) {
  const fractionDigits = Number.isInteger(value) ? 0 : DECIMAL_FRACTION_DIGITS;
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatAbsoluteNumber(value: number, locale: string) {
  const scale = COMPACT_SCALES.find(
    ({ divisor }) => Math.abs(value) >= divisor,
  );
  if (!scale) return formatDecimalNumber(value, locale);
  const suffix = locale.startsWith("en") ? scale.englishSuffix : scale.suffix;
  const scaled = new Intl.NumberFormat(locale, {
    minimumFractionDigits: DECIMAL_FRACTION_DIGITS,
    maximumFractionDigits: DECIMAL_FRACTION_DIGITS,
  }).format(value / scale.divisor);
  return `${scaled} ${suffix}`;
}

export function formatPercentageNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: DECIMAL_FRACTION_DIGITS,
    maximumFractionDigits: DECIMAL_FRACTION_DIGITS,
  }).format(value);
}
