/**
 * Formatação dos números territoriais mostrados ao usuário (painel, relatório,
 * legenda). Valores absolutos grandes, como o PIB, viravam uma fileira de
 * dígitos ("10.943.345.438.880") que ninguém lê de relance; a partir de um
 * milhão eles são resumidos com a escala por extenso ("10,94 trilhões"), que
 * se lê sem precisar decifrar sigla como "Tri" ou "Mi". Decimais aparecem sempre com duas casas, para
 * não mostrar "12,0" ao lado de "12,35".
 *
 * @example
 * formatAbsoluteNumber(10_943_345_438_880, "pt-BR"); // "10,94 trilhões"
 * formatAbsoluteNumber(2_500_000, "pt-BR"); // "2,50 milhões"
 * formatAbsoluteNumber(1234.5, "pt-BR"); // "1.234,50"
 */
type ScaleNames = { singular: string; plural: string };

// Em espanhol, 1e9 é "mil millones": "billón" é 1e12, como em "trillion".
const COMPACT_SCALES: readonly {
  divisor: number;
  names: Record<"pt" | "en" | "es", ScaleNames>;
}[] = [
  {
    divisor: 1e12,
    names: {
      pt: { singular: "trilhão", plural: "trilhões" },
      en: { singular: "trillion", plural: "trillion" },
      es: { singular: "billón", plural: "billones" },
    },
  },
  {
    divisor: 1e9,
    names: {
      pt: { singular: "bilhão", plural: "bilhões" },
      en: { singular: "billion", plural: "billion" },
      es: { singular: "mil millones", plural: "mil millones" },
    },
  },
  {
    divisor: 1e6,
    names: {
      pt: { singular: "milhão", plural: "milhões" },
      en: { singular: "million", plural: "million" },
      es: { singular: "millón", plural: "millones" },
    },
  },
];

function scaleLanguage(locale: string): "pt" | "en" | "es" {
  if (locale.startsWith("en")) return "en";
  if (locale.startsWith("es")) return "es";
  return "pt";
}

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
  const scaledValue = value / scale.divisor;
  const names = scale.names[scaleLanguage(locale)];
  // "1,50 milhão", mas "2,00 milhões": o plural começa em dois.
  const name = Math.abs(scaledValue) < 2 ? names.singular : names.plural;
  const scaled = new Intl.NumberFormat(locale, {
    minimumFractionDigits: DECIMAL_FRACTION_DIGITS,
    maximumFractionDigits: DECIMAL_FRACTION_DIGITS,
  }).format(scaledValue);
  return `${scaled} ${name}`;
}

export function formatPercentageNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: DECIMAL_FRACTION_DIGITS,
    maximumFractionDigits: DECIMAL_FRACTION_DIGITS,
  }).format(value);
}
