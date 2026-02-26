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