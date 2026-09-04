/**
 * Serializa um valor com as chaves em ordem alfabética, para comparar dois
 * objetos ignorando a ordem em que os campos foram escritos.
 *
 * Existe porque as conferências de escrita do catálogo comparam o `imageData`
 * antes e depois da edição, e o Contentful devolve as chaves de um campo Object
 * em ordens diferentes entre o rascunho e a versão publicada. Um
 * `JSON.stringify` cru acusaria diferença onde não há nenhuma.
 *
 * @example
 * canonicalJson({ b: 1, a: 2 }) === canonicalJson({ a: 2, b: 1 }); // true
 */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entryValue]) => entryValue !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, entryValue]) =>
        `${JSON.stringify(key)}:${canonicalJson(entryValue)}`,
    );
  return `{${entries.join(",")}}`;
}
