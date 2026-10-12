import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: string) => {
    return (key: string) => `${namespace}.${key}`;
  },
}));

vi.mock("@/repositories/content/homeTextsRepository", () => ({
  getHomeTexts: vi.fn(),
}));

import { getHomeTexts } from "@/repositories/content/homeTextsRepository";
import { getHomeTextsForLocale } from "@/app/[locale]/homeTexts";

const mockedGetHomeTexts = vi.mocked(getHomeTexts);

describe("getHomeTextsForLocale", () => {
  beforeEach(() => {
    mockedGetHomeTexts.mockReset();
  });

  it("puts what is published in Contentful over the Portuguese translations", async () => {
    mockedGetHomeTexts.mockResolvedValue({
      sections: {
        ferramentas: { title: "Título do CMS", subtitle: "Apoio do CMS" },
        depoimentos: { title: "Depoimentos do CMS" },
      },
      highlights: [{ value: "7", label: "Instituições", description: "d" }],
      tools: [
        {
          id: "analysis",
          name: "Priorização",
          shortText: "curto",
          buttonText: "Explore a Priorização",
        },
      ],
      features: [],
      testimonials: [{ quote: "Citação", author: "Pesquisador" }],
    });

    const texts = await getHomeTextsForLocale("pt");

    expect(texts.highlights).toEqual([
      { value: "7", label: "Instituições", description: "d" },
    ]);
    expect(texts.tools.title).toBe("Título do CMS");
    expect(texts.tools.subtitle).toBe("Apoio do CMS");
    // A ordem das ferramentas é fixa; a que falta no CMS vem da tradução.
    expect(texts.tools.items.map((item) => item.id)).toEqual([
      "monitoring",
      "communication",
      "analysis",
    ]);
    expect(texts.tools.items[0].name).toBe(
      "PlatformModulesSection.modules.monitoring.title",
    );
    expect(texts.tools.items[2].name).toBe("Priorização");
    expect(texts.testimonials).toEqual({
      title: "Depoimentos do CMS",
      items: [{ quote: "Citação", author: "Pesquisador" }],
    });
    // Seção sem entrada no CMS continua inteira na tradução.
    expect(texts.publicPolicy.title).toBe("PublicPolicySection.title");
    expect(texts.features.items).toHaveLength(4);
    expect(texts.features.items[0].title).toBe(
      "NewsSection.items.indice-combinado-de-seca.title",
    );
  });

  it("keeps English and Spanish on the translation files", async () => {
    const texts = await getHomeTextsForLocale("en");

    expect(mockedGetHomeTexts).not.toHaveBeenCalled();
    expect(texts.tools.title).toBe("PlatformModulesSection.title");
    expect(texts.highlights).toHaveLength(5);
  });

  it("falls back to the translations when Contentful fails", async () => {
    mockedGetHomeTexts.mockResolvedValue(null);

    const texts = await getHomeTextsForLocale("pt");

    expect(texts.publicPolicy.text).toBe("PublicPolicySection.text");
    expect(texts.testimonials.items).toHaveLength(6);
  });
});
