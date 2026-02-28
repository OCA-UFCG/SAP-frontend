export function normalizeContentfulImage(url: string) {
  switch (true) {
    // Se já começa com http ou https → retorna direto
    case url.startsWith("http://"):
    case url.startsWith("https://"):
      return url;

    // Se começa com // (Contentful padrão)
    case url.startsWith("//"):
      return `https:${url}`;

    // Se for imagem local (storybook/mock)
    case url.startsWith("/"):
      return url;

    default:
      return url;
  }
}

export const sortContentByDesiredOrder = <T extends { id: string }>(
  content: T[],
  desiredOrder: string[],
): T[] => {
  return [...content]
    .filter((item) => desiredOrder.includes(item.id))  // ← filtra antes
    .sort((a, b) => desiredOrder.indexOf(a.id) - desiredOrder.indexOf(b.id));
};

/**
 * Returns either '#292829' or '#FFFFFF'
 * depending on which has better contrast with the background.
 */
export function getContrastTextColor(backgroundColor: string): string {
  const rgb = hexToRgb(backgroundColor);
  if (!rgb) return "#292829";

  const luminance = getRelativeLuminance(rgb.r, rgb.g, rgb.b);

  // WCAG recommended threshold
  return luminance > 0.179 ? "#292829" : "#FFFFFF";
}

function hexToRgb(hex: string) {
  const cleaned = hex.replace("#", "");

  const bigint = parseInt(
    cleaned.length === 3
      ? cleaned.split("").map((c) => c + c).join("")
      : cleaned,
    16
  );

  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function getRelativeLuminance(r: number, g: number, b: number) {
  const srgb = [r, g, b].map((v) => {
    const c = v / 255;
    return c <= 0.03928
      ? c / 12.92
      : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * srgb[0] +
         0.7152 * srgb[1] +
         0.0722 * srgb[2];
}