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
        subtitle
        text
        buttonText
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
        author
        authorDetail
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
  | "ferramentas"
  | "politica-publica"
  | "recursos-em-destaque"
  | "depoimentos";

export interface HomeSectionTextI {
  title: string;
  subtitle?: string;
  text?: string;
  buttonText?: string;
}

/** O que o Contentful tem publicado; uma lista vazia é seção sem entradas. */
export interface HomeTextsContent {
  sections: Partial<Record<HomeSectionId, HomeSectionTextI>>;
  highlights: HomeHighlightI[];
  tools: HomeToolTextI[];
  features: HomeFeatureI[];
  testimonials: HomeTestimonialI[];
}

interface HomeTextsResponse {
  homeSectionCollection: {
    items: Array<(HomeSectionTextI & { identifier: HomeSectionId }) | null>;
  };
  homeHighlightCollection: { items: Array<HomeHighlightI | null> };
  homeToolCollection: {
    items: Array<{
      tool: string;
      name: string;
      shortText: string;
      fullText?: string | null;
      buttonText: string;
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
      author: string;
      authorDetail?: string | null;
    } | null>;
  };
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
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
        subtitle: section.subtitle ?? undefined,
        text: section.text ?? undefined,
        buttonText: section.buttonText ?? undefined,
      };
    }

    return {
      sections,
      highlights:
        data.homeHighlightCollection?.items?.filter(isDefined) ?? [],
      tools: (data.homeToolCollection?.items ?? [])
        .filter(isDefined)
        .filter((item) => TOOL_IDS[item.tool])
        .map((item) => ({
          id: TOOL_IDS[item.tool],
          name: item.name,
          shortText: item.shortText,
          fullText: item.fullText ?? undefined,
          buttonText: item.buttonText,
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
        })),
    };
  } catch (error) {
    console.error("Erro ao buscar os textos da home no Contentful:", error);
    return null;
  }
}
