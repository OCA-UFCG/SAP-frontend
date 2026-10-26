/**
 * Código de idioma para o atributo `lang` do HTML. A URL usa só "pt", mas o
 * eMAG pede "pt-BR", e leitores de tela escolhem a voz por esse código: com
 * "pt" puro, alguns (como o NVDA com eSpeak) leem com a pronúncia de Portugal.
 *
 * @example htmlLang("pt"); // "pt-BR"
 */
export function htmlLang(locale: string) {
  return locale === "pt" ? "pt-BR" : locale;
}
