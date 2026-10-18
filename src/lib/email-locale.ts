import { routing } from "@/translations/routing-config";

/**
 * Idioma para os e-mails desta pessoa. Vem do navegador, então é validado
 * contra a lista de idiomas do site — um valor qualquer cairia no português.
 */
export function resolveEmailLocale(value: unknown) {
  return typeof value === "string" &&
    (routing.locales as readonly string[]).includes(value)
    ? value
    : routing.defaultLocale;
}
