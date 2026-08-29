/**
 * Cor hexadecimal no formato que o `panelLayer` guarda: `#RRGGBB`.
 *
 * É a mesma regra usada na validação do rascunho do catálogo e no campo de cor
 * das classes, para que a tela não aceite nada que o servidor vá recusar.
 */
export const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/iu;

const HEX_DIGITS_PATTERN = /^[0-9a-f]+$/iu;

/**
 * Normaliza o que a pessoa digitou ou colou para `#RRGGBB` em maiúsculas.
 *
 * Aceita as formas que aparecem quando se copia uma cor de outra ferramenta —
 * com ou sem `#`, com espaços em volta, e a abreviação de três dígitos que o
 * CSS permite. Devolve `null` quando não é uma cor válida, e é isso que o campo
 * usa para decidir se já pode gravar no rascunho.
 *
 * @example
 * normalizeHexColor(" #ca281b ") // "#CA281B"
 * normalizeHexColor("fff")       // "#FFFFFF"
 * normalizeHexColor("#12345")    // null
 */
export function normalizeHexColor(input: string): string | null {
  const digits = input.trim().replace(/^#/u, "");
  if (!HEX_DIGITS_PATTERN.test(digits)) return null;
  if (digits.length === 3) {
    const expanded = digits
      .split("")
      .map((digit) => digit + digit)
      .join("");
    return `#${expanded.toUpperCase()}`;
  }
  if (digits.length !== 6) return null;
  return `#${digits.toUpperCase()}`;
}
