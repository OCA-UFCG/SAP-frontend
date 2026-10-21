import { describe, expect, it, vi } from "vitest";
import ptTitles from "@/translations/pt/PageTitles.json";
import enTitles from "@/translations/en/PageTitles.json";
import esTitles from "@/translations/es/PageTitles.json";

const TITLES: Record<string, Record<string, string>> = {
  pt: ptTitles.PageTitles,
  en: enTitles.PageTitles,
  es: esTitles.PageTitles,
};

/** Tradutor de `PageTitles` por locale, como o `getTranslations` do servidor. */
class FakePageTitleTranslations {
  static for({ locale, namespace }: { locale: string; namespace: string }) {
    if (namespace !== "PageTitles") {
      throw new Error(`unexpected namespace ${namespace}, expected PageTitles`);
    }
    return (key: string) => TITLES[locale][key];
  }
}

vi.mock("next-intl/server", () => ({
  getTranslations: async (options: { locale: string; namespace: string }) =>
    FakePageTitleTranslations.for(options),
}));

import { pageTitleMetadata, siteTitleMetadata } from "@/lib/page-metadata";

describe("page titles", () => {
  it("names the page in the visitor's language", async () => {
    const generateMetadata = pageTitleMetadata("glossary");

    const pt = await generateMetadata({ params: Promise.resolve({ locale: "pt" }) });
    const en = await generateMetadata({ params: Promise.resolve({ locale: "en" }) });

    expect(pt.title).toBe("Glossário");
    expect(en.title).toBe("Glossary");
  });

  it("completes every page title with the site name", async () => {
    const metadata = await siteTitleMetadata("es");

    expect(metadata.title).toEqual({
      default: "Portal SEDES",
      template: "%s | Portal SEDES",
    });
  });

  // Uma chave que falta num idioma viraria o nome da chave na aba do navegador.
  it("has every title translated in the three languages", () => {
    const keys = Object.keys(TITLES.pt).sort();

    expect(Object.keys(TITLES.en).sort()).toEqual(keys);
    expect(Object.keys(TITLES.es).sort()).toEqual(keys);
  });
});
