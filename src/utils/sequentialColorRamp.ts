/**
 * Uma rampa de cores clara → escura a partir de uma cor só.
 *
 * A detecção automática das faixas precisa colorir n faixas sem pedir n cores
 * ao operador, e uma paleta fixa brigaria com a identidade do índice. Partindo
 * da cor do indicador, que ele já escolheu, a rampa mantém o mesmo matiz e
 * varia só a intensidade — que é o que a legenda de um índice de valor precisa
 * comunicar: a mesma coisa, em mais ou em menos.
 *
 * @example
 * buildSequentialColorRamp("#1B5E20", 3); // ["#D1DDD2", "#769978", "#1B5E20"]
 */
export function buildSequentialColorRamp(
  baseColor: string,
  count: number,
): string[] {
  const base = parseHexColor(baseColor) ?? { red: 27, green: 94, blue: 32 };
  if (count <= 1) return [toHexColor(base)];

  return Array.from({ length: count }, (_entry, position) =>
    toHexColor(
      mixWithWhite(
        base,
        LIGHTEST_MIX + (1 - LIGHTEST_MIX) * (position / (count - 1)),
      ),
    ),
  );
}

/** A faixa mais clara guarda um pouco da cor: branco puro se confunde com "sem dado". */
const LIGHTEST_MIX = 0.18;

interface RgbColor {
  red: number;
  green: number;
  blue: number;
}

function parseHexColor(value: string): RgbColor | null {
  const hex = value.trim().replace(/^#/u, "");
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : hex;
  if (!/^[0-9a-f]{6}$/iu.test(expanded)) return null;
  return {
    red: Number.parseInt(expanded.slice(0, 2), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    blue: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

function mixWithWhite(color: RgbColor, weight: number): RgbColor {
  const blend = (channel: number) => Math.round(255 + (channel - 255) * weight);
  return {
    red: blend(color.red),
    green: blend(color.green),
    blue: blend(color.blue),
  };
}

function toHexColor({ red, green, blue }: RgbColor) {
  const channel = (value: number) =>
    Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0");
  return `#${channel(red)}${channel(green)}${channel(blue)}`.toUpperCase();
}
