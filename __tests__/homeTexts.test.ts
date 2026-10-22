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
      testimonials: [
        {
          quote: "Citação",
          author: "Pesquisador",
          translations: { en: { quote: "Quote" } },
        },
      ],
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
    expect(texts.features.items.map((item) => item.module)).toEqual([
      "monitoring",
      "communication",
      "analysis",
    ]);
    expect(texts.features.items[0].title).toBe(
      "NewsSection.items.indice-combinado-de-seca.title",
    );
  });

  it("keeps the first featured resource of each tool, in the tools order", async () => {
    const feature = (id: string, module: "monitoring" | "analysis") => ({
      id,
      module,
      title: id,
      description: "",
      href: "/platform",
    });
    mockedGetHomeTexts.mockResolvedValue({
      sections: {},
      highlights: [],
      tools: [],
      features: [
        feature("priorizacao", "analysis"),
        feature("seca", "monitoring"),
        feature("territorios", "monitoring"),
      ],
      testimonials: [],
    });

    const texts = await getHomeTextsForLocale("pt");

    expect(texts.features.items.map((item) => item.id)).toEqual([
      "seca",
      "priorizacao",
    ]);
  });

  it("takes the English and Spanish testimonials and titles from their own Contentful fields", async () => {
    mockedGetHomeTexts.mockResolvedValue({
      sections: {
        depoimentos: {
          title: "O que dizem sobre o SEDES",
          titleTranslations: { en: "What people say about SEDES" },
        },
      },
      highlights: [],
      tools: [],
      features: [],
      testimonials: [
        {
          quote: "Citação",
          author: "Extensionista rural",
          authorDetail: "OCA",
          image: "https://img/depoimento.jpg",
          translations: {
            en: { quote: "Quote", author: "Rural extension agent" },
            es: {},
          },
        },
      ],
    });

    const english = await getHomeTextsForLocale("en");
    expect(english.testimonials).toEqual({
      title: "What people say about SEDES",
      items: [
        {
          quote: "Quote",
          author: "Rural extension agent",
          // Sem tradução, fica o de português.
          authorDetail: "OCA",
          image: "https://img/depoimento.jpg",
        },
      ],
    });
    // Seção sem título em inglês continua com o da tradução.
    expect(english.tools.title).toBe("PlatformModulesSection.title");

    const spanish = await getHomeTextsForLocale("es");
    expect(spanish.testimonials).toEqual({
      title: "UseCasesSection.title",
      items: [
        {
          quote: "Citação",
          author: "Extensionista rural",
          authorDetail: "OCA",
          image: "https://img/depoimento.jpg",
        },
      ],
    });
  });

  it("keeps the other English and Spanish texts on the translation files, with the Contentful photos", async () => {
    mockedGetHomeTexts.mockResolvedValue({
      sections: {
        ferramentas: { title: "Título do CMS" },
        "politica-publica": {
          title: "Política do CMS",
          images: ["https://img/c1.jpg"],
        },
      },
      highlights: [{ value: "7", label: "Instituições", description: "d" }],
      tools: [
        {
          id: "analysis",
          name: "Priorização",
          shortText: "curto",
          buttonText: "Explore a Priorização",
          image: "https://img/priorizacao.jpg",
        },
      ],
      features: [],
      testimonials: [],
    });

    const texts = await getHomeTextsForLocale("en");

    expect(texts.tools.title).toBe("PlatformModulesSection.title");
    expect(texts.highlights).toHaveLength(5);
    expect(texts.tools.items[2].name).toBe(
      "PlatformModulesSection.modules.analysis.title",
    );
    expect(texts.tools.items[2].image).toBe("https://img/priorizacao.jpg");
    // Sem foto no CMS, o card fica com a do código.
    expect(texts.tools.items[0].image).toBeUndefined();
    expect(texts.publicPolicy.title).toBe("PublicPolicySection.title");
    expect(texts.publicPolicy.images).toEqual(["https://img/c1.jpg"]);
  });

  it("falls back to the translations when Contentful fails", async () => {
    mockedGetHomeTexts.mockResolvedValue(null);

    const texts = await getHomeTextsForLocale("pt");

    expect(texts.publicPolicy.text).toBe("PublicPolicySection.text");
    expect(texts.testimonials.items).toHaveLength(6);
  });
});
