import {
  CONTENTFUL_COLLECTION_LIMIT,
  getContent,
} from "@/infrastructure/contentful/client";
import {
  HomeFeatureI,
  HomeHighlightI,
  HomeTestimonialI,
  HomeToolTextI,
  PlatformModuleI,
} from "@/utils/interfaces";

// Os textos da home ficam numa query separada da `GET_HOME_PAGE`: se um destes
// tipos faltar no Contentful, só os textos voltam para as traduções, sem
// derrubar o carrossel e as instituições junto.
const GET_HOME_TEXTS = `
  query GetHomeTexts($locale: String!) {
    homeSectionCollection(limit: 20, locale: $locale) {
      items {
        identifier
        title
        titleEn
        titleEs
        subtitle
        text
        buttonText
        imagesCollection(limit: 4) {
          items {
            url
          }
        }
      }
    }

    homeHighlightCollection(limit: 10, locale: $locale, order: order_ASC) {
      items {
        value
        label
        description
      }
    }

    homeToolCollection(limit: 10, locale: $locale) {
      items {
        tool
        name
        shortText
        fullText
        buttonText
        image {
          url
        }
        aboutImage {
          url
        }
      }
    }

    homeFeatureCollection(limit: ${CONTENTFUL_COLLECTION_LIMIT}, locale: $locale, order: order_ASC) {
      items {
        sys {
          id
        }
        tool
        title
        description
        link
        date
      }
    }

    homeTestimonialCollection(limit: ${CONTENTFUL_COLLECTION_LIMIT}, locale: $locale, order: order_ASC) {
      items {
        quote
        quoteEn
        quoteEs
        author
        authorEn
        authorEs
        authorDetail
        authorDetailEn
        authorDetailEs
        photo {
          url
        }
      }
    }
  }
`;

/** Valores do campo "Ferramenta" no Contentful, escritos para quem edita. */
const TOOL_IDS: Record<string, PlatformModuleI["id"]> = {
  monitoramento: "monitoring",
  comunicacao: "communication",
  priorizacao: "analysis",
};

/** Para onde leva um card de recurso sem link próprio. */
export const HOME_TOOL_HREFS: Record<PlatformModuleI["id"], string> = {
  monitoring: "/platform",
  communication: "/platform?section=communication",
  analysis: "/platform/amfe",
};

export type HomeSectionId =
  "ferramentas" | "politica-publica" | "recursos-em-destaque" | "depoimentos";

/**
 * Idiomas da página que têm campos próprios no Contentful ("Título (inglês)",
 * "Citação (espanhol)"...). O português fica nos campos principais.
 */
export type HomeTranslatedLocale = "en" | "es";

type Translations<T> = Partial<Record<HomeTranslatedLocale, T>>;

export interface HomeSectionTextI {
  title: string;
  /** Título em inglês e espanhol; vazio, a página usa o da tradução. */
  titleTranslations?: Translations<string>;
  subtitle?: string;
  text?: string;
  buttonText?: string;
  /** Fotos da seção; hoje só a "politica-publica" usa, na colagem. */
  images?: string[];
}

/** Depoimento com os textos de inglês e espanhol; o que faltar fica o português. */
export interface HomeTestimonialContent extends HomeTestimonialI {
  translations: Translations<
    Partial<Pick<HomeTestimonialI, "quote" | "author" | "authorDetail">>
  >;
}

/** O que o Contentful tem publicado; uma lista vazia é seção sem entradas. */
export interface HomeTextsContent {
  sections: Partial<Record<HomeSectionId, HomeSectionTextI>>;
  highlights: HomeHighlightI[];
  tools: HomeToolTextI[];
  features: HomeFeatureI[];
  testimonials: HomeTestimonialContent[];
}

interface HomeTextsResponse {
  homeSectionCollection: {
    items: Array<
      | (Omit<HomeSectionTextI, "images" | "titleTranslations"> & {
          identifier: HomeSectionId;
          titleEn?: string | null;
          titleEs?: string | null;
          imagesCollection?: { items: Array<AssetUrl | null> } | null;
        })
      | null
    >;
  };
  homeHighlightCollection: { items: Array<HomeHighlightI | null> };
  homeToolCollection: {
    items: Array<{
      tool: string;
      name: string;
      shortText: string;
      fullText?: string | null;
      buttonText: string;
      image?: AssetUrl | null;
      aboutImage?: AssetUrl | null;
    } | null>;
  };
  homeFeatureCollection: {
    items: Array<{
      sys: { id: string };
      tool: string;
      title: string;
      description: string;
      link?: string | null;
      date?: string | null;
    } | null>;
  };
  homeTestimonialCollection: {
    items: Array<{
      quote: string;
      quoteEn?: string | null;
      quoteEs?: string | null;
      author: string;
      authorEn?: string | null;
      authorEs?: string | null;
      authorDetail?: string | null;
      authorDetailEn?: string | null;
      authorDetailEs?: string | null;
      photo?: AssetUrl | null;
    } | null>;
  };
}

interface AssetUrl {
  url?: string | null;
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

/** Campo de tradução em branco conta como não preenchido. */
function filled(value?: string | null): string | undefined {
  return value?.trim() || undefined;
}

export async function getHomeTexts(): Promise<HomeTextsContent | null> {
  try {
    // Todo o conteúdo do Contentful fica em `en-US`, como no resto do site.
    const data = await getContent<HomeTextsResponse>(GET_HOME_TEXTS, {
      locale: "en-US",
    });

    const sections: HomeTextsContent["sections"] = {};
    for (const section of data.homeSectionCollection?.items ?? []) {
      if (!section) continue;
      sections[section.identifier] = {
        title: section.title,
        titleTranslations: {
          en: filled(section.titleEn),
          es: filled(section.titleEs),
        },
        subtitle: section.subtitle ?? undefined,
        text: section.text ?? undefined,
        buttonText: section.buttonText ?? undefined,
        images: section.imagesCollection?.items
          ?.map((image) => image?.url)
          .filter((url): url is string => !!url),
      };
    }

    return {
      sections,
      highlights: data.homeHighlightCollection?.items?.filter(isDefined) ?? [],
      tools: (data.homeToolCollection?.items ?? [])
        .filter(isDefined)
        .filter((item) => TOOL_IDS[item.tool])
        .map((item) => ({
          id: TOOL_IDS[item.tool],
          name: item.name,
          shortText: item.shortText,
          fullText: item.fullText ?? undefined,
          buttonText: item.buttonText,
          image: item.image?.url ?? undefined,
          aboutImage: item.aboutImage?.url ?? undefined,
        })),
      features: (data.homeFeatureCollection?.items ?? [])
        .filter(isDefined)
        .filter((item) => TOOL_IDS[item.tool])
        .map((item) => {
          const tool = TOOL_IDS[item.tool];
          return {
            id: item.sys.id,
            module: tool,
            title: item.title,
            description: item.description,
            href: item.link?.trim() || HOME_TOOL_HREFS[tool],
            // O campo "Data" do Contentful chega como data e hora (ISO).
            date: item.date ? item.date.slice(0, 10) : undefined,
          };
        }),
      testimonials: (data.homeTestimonialCollection?.items ?? [])
        .filter(isDefined)
        .map((item) => ({
          quote: item.quote,
          author: item.author,
          authorDetail: item.authorDetail ?? undefined,
          image: item.photo?.url ?? undefined,
          translations: {
            en: {
              quote: filled(item.quoteEn),
              author: filled(item.authorEn),
              authorDetail: filled(item.authorDetailEn),
            },
            es: {
              quote: filled(item.quoteEs),
              author: filled(item.authorEs),
              authorDetail: filled(item.authorDetailEs),
            },
          },
        })),
    };
  } catch (error) {
    console.error("Erro ao buscar os textos da home no Contentful:", error);
    return null;
  }
}
