import type { ImageLoaderProps } from "next/image";
import { normalizeContentfulImage } from "./functions";

const CONTENTFUL_IMAGES_HOST = "images.ctfassets.net";

/**
 * Pede a foto ao próprio Contentful já na largura em que ela vai aparecer, em
 * WebP. As fotos do banner sobem com 4.000 px e até 6,6 MB; no celular, a de
 * 1.080 px fica com 68 KB. Quem redimensiona é a CDN do Contentful, então o
 * nosso servidor não gasta nada com isso.
 *
 * Endereço fora do Contentful, ou SVG (que ele não converte), volta como veio.
 *
 * <Image loader={contentfulImageLoader} src={banner.image.url} sizes="100vw" fill />
 */
export function contentfulImageLoader({
  src,
  width,
  quality,
}: ImageLoaderProps) {
  const normalized = normalizeContentfulImage(src);
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return normalized;
  }
  if (
    url.hostname !== CONTENTFUL_IMAGES_HOST ||
    url.pathname.endsWith(".svg")
  ) {
    return normalized;
  }

  // O Contentful recusa larguras acima de 4.000 px.
  url.searchParams.set("w", String(Math.min(width, 4000)));
  url.searchParams.set("q", String(quality ?? 75));
  url.searchParams.set("fm", "webp");
  return url.toString();
}
