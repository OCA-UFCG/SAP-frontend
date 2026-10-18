import "server-only";
import { normalizeContentfulImage } from "@/utils/functions";

/**
 * A prévia de cada foto da home: a própria foto com 6 px de largura, em PNG
 * de 256 cores, embutida na página. Ampliada e borrada pelo `BlurPreview`, ela
 * ocupa o lugar da foto até a foto chegar.
 *
 * Por que PNG de 256 cores: o Contentful mantém os metadados do JPEG e do WebP
 * (perfil de cor, EXIF), e até uma imagem de 16 px saía com 3,5 KB. Neste
 * formato, cada prévia tem de 120 a 260 bytes.
 */
const PREVIEW_QUERY = "w=6&fm=png&fl=png8";

/** Sem resposta neste prazo, a foto fica sem prévia em vez de atrasar a home. */
const TIMEOUT_MS = 2000;

/** Endereço da foto, como os componentes o recebem → prévia em `data:` URL. */
export type BlurPreviews = Record<string, string>;

function previewUrl(src: string) {
  let url: URL;
  try {
    url = new URL(normalizeContentfulImage(src));
  } catch {
    return null;
  }
  // Arquivo local e SVG ficam sem prévia: o Contentful só redimensiona as
  // fotos que ele mesmo guarda, e não converte SVG.
  if (
    url.hostname !== "images.ctfassets.net" ||
    url.pathname.endsWith(".svg")
  ) {
    return null;
  }
  return `${url.origin}${url.pathname}?${PREVIEW_QUERY}`;
}

async function fetchPreview(src: string) {
  const url = previewUrl(src);
  if (!url) return null;
  try {
    // O endereço de um asset do Contentful muda quando a foto muda, então a
    // prévia pode ficar guardada para sempre.
    const response = await fetch(url, {
      cache: "force-cache",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Busca as prévias de várias fotos de uma vez. Foto sem prévia (fora do
 * Contentful, SVG, falha ou demora) simplesmente não aparece no resultado.
 *
 * @example
 * const previews = await getBlurPreviews([banner.image.url, tool.image]);
 * <BlurPreview src={previews[banner.image.url]} />
 */
export async function getBlurPreviews(
  sources: Array<string | undefined>,
): Promise<BlurPreviews> {
  const unique = [...new Set(sources.filter((src): src is string => !!src))];
  const previews = await Promise.all(unique.map(fetchPreview));
  return Object.fromEntries(
    unique.flatMap((src, index) => {
      const preview = previews[index];
      return preview ? [[src, preview]] : [];
    }),
  );
}
