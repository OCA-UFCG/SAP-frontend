import { SecaData, SecaRootObject } from "./interfaces";
import { createClient } from "contentful";

export const getContent = async (contentTypes: string[]) => {
  const client = createClient({
    accessToken: process.env.NEXT_PUBLIC_CONTENTFUL_ACCESS_TOKEN || "",
    space: process.env.NEXT_PUBLIC_CONTENTFUL_SPACE || "",
  });
  const content: any = {};

  for (const type of contentTypes) {
    const res = await client.getEntries({ content_type: type });
    content[type] = res.items;
  }

  return content;
};


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

export const sortContentByDesiredOrder = <T extends { path: string }>(
  content: T[],
  desiredOrder: string[],
): T[] => {
  return [...content]
    .filter((item) => desiredOrder.includes(item.path)) // ← filtra antes
    .sort(
      (a, b) => desiredOrder.indexOf(a.path) - desiredOrder.indexOf(b.path),
    );
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
      ? cleaned
        .split("")
        .map((c) => c + c)
        .join("")
      : cleaned,
    16,
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
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
}

export const normalize = (str: string) =>
  str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, ""); // removes accents

export type StateSearchResult =
  | { type: "uf"; key: string }
  | { type: "br"; key: "br" };

export function resolveStateKeyFromSearch(
  query: string,
  statesObj: Record<string, string>,
): StateSearchResult {
  const searchLower = query.toLowerCase().trim();

  // UF (key in statesObj)
  if (statesObj[searchLower]) {
    return { type: "uf", key: searchLower };
  }

  // Full name (value in statesObj)
  const foundUF = Object.entries(statesObj).find(
    ([_, name]) => name.toLowerCase() === searchLower,
  );

  if (foundUF) {
    return { type: "uf", key: foundUF[0] };
  }

  return { type: "br", key: "br" };
}


/**
 * Busca os dados de seca a partir de uma chave (UF ou 'br')
 * @param key - Sigla do estado em minúsculo (ex: 'mg', 'sp', 'br')
 */
export async function getSecaDataByKey(key: string): Promise<SecaData | null> {
  try {
    // No Next.js, arquivos em /public são acessados pela raiz '/'
    const response = await fetch("/dados-seca.json");

    if (!response.ok) {
      throw new Error(`Erro ao carregar dados: ${response.statusText}`);
    }

    const fullData: SecaRootObject = await response.json();

    // Normaliza a entrada para evitar erros de Case Sensitivity
    const normalizedKey = key.toLowerCase();

    return fullData[normalizedKey] || null;
  } catch (error) {
    console.error("Erro na busca de dados de seca:", error);
    return null;
  }
}
