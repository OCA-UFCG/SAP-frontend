import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ptTitles from "@/translations/pt/PageTitles.json";

/** As chaves de `PageTitles` que nomeiam páginas (`site` e `description` são do layout). */
export type PageTitleKey = Exclude<
  keyof (typeof ptTitles)["PageTitles"],
  "site" | "description"
>;

type LocaleParams = { params: Promise<{ locale: string }> };

/**
 * O título de cada aba do navegador: o leitor de tela anuncia o `<title>` ao
 * trocar de página, e com um único "Portal SEDES" em todo o site não dava
 * para saber onde se estava (WCAG 2.4.2). O layout completa com o nome do
 * site pelo `title.template`.
 *
 * @example
 * export const generateMetadata = pageTitleMetadata("glossary");
 * // <title>Glossário | Portal SEDES</title>
 */
export function pageTitleMetadata(key: PageTitleKey) {
  return async ({ params }: LocaleParams): Promise<Metadata> => {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "PageTitles" });
    return { title: t(key) };
  };
}

/**
 * O título padrão e o modelo `"%s | Portal SEDES"` que as páginas preenchem.
 *
 * @example
 * siteTitleMetadata("pt") // { title: { default: "Portal SEDES", template: "%s | Portal SEDES" }, ... }
 */
export async function siteTitleMetadata(locale: string): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "PageTitles" });
  const site = t("site");
  return {
    title: { default: site, template: `%s | ${site}` },
    description: t("description"),
  };
}
