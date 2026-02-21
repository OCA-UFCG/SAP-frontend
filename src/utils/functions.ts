export function normalizeContentfulImage(url: string) {
  // Se já começa com http ou https → retorna direto
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Se começa com // (Contentful padrão)
  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  // Se for imagem local (storybook/mock)
  if (url.startsWith("/")) {
    return url;
  }

  return url;
}