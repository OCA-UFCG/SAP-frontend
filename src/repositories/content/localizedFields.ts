/**
 * Inglês e espanhol do Contentful ficam em campos próprios, com o sufixo do
 * idioma ("titleEn", "textEs"...), ao lado do campo em português. O padrão é o
 * dos depoimentos da home (PR #425): o espaço só tem um locale com conteúdo.
 */
const SUFFIXES: Record<string, "En" | "Es"> = { en: "En", es: "Es" };

/** Os nomes dos campos de tradução, para pôr na query GraphQL. */
export function translatedFieldNames(fields: readonly string[]): string {
  return fields.flatMap((field) => [`${field}En`, `${field}Es`]).join("\n");
}

/** O mesmo para um campo de texto rico, que na query pede o `json`. */
export function translatedRichTextFieldNames(field: string): string {
  return `${field}En {\n  json\n}\n${field}Es {\n  json\n}`;
}

function isFilled(value: unknown): boolean {
  if (typeof value === "string") return value.trim() !== "";
  // Texto rico: `{ json: { content: [...] } }`. Sem parágrafo é campo vazio.
  if (value && typeof value === "object" && "json" in value) {
    const json = (value as { json?: { content?: unknown[] } }).json;
    return Boolean(json?.content?.length);
  }
  return false;
}

/**
 * A entrada com cada campo no idioma da página e sem os campos de tradução,
 * que não precisam seguir para a página. Tradução vazia fica com o português.
 *
 * @example
 * localizeFields({ title: "Seca", titleEn: "Drought", titleEs: "" }, ["title"], "en");
 * // → { title: "Drought" }
 */
export function localizeFields<T extends object>(
  item: T,
  fields: readonly string[],
  locale?: string,
): T {
  const suffix = locale ? SUFFIXES[locale] : undefined;
  const record = item as Record<string, unknown>;
  const localized: Record<string, unknown> = { ...record };

  for (const field of fields) {
    const translated = suffix ? record[`${field}${suffix}`] : undefined;
    if (isFilled(translated)) localized[field] = translated;
    delete localized[`${field}En`];
    delete localized[`${field}Es`];
  }
  return localized as T;
}
