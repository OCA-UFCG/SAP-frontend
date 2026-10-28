import {
  CONTENTFUL_COLLECTION_LIMIT,
  getContent,
} from "@/infrastructure/contentful/client";
import {
  AboutSectionI,
  IMainBanner,
  PartnerI,
  SectionHeaderI,
  TabsSectionI,
} from "@/utils/interfaces";

const GET_HOME_PAGE = `
  query GetHomePage($locale: String!) {
    # Pelo campo "Ordem"; banners sem ordem vêm depois, do mais antigo ao mais novo.
    bannerCollection(limit: 5, locale: $locale, order: [order_ASC, sys_firstPublishedAt_ASC]) {
      items {
        title
        subtitle
        linkText
        link
        image {
          url
        }
      }
    }

    secaoSobreCollection(limit: ${CONTENTFUL_COLLECTION_LIMIT}, locale: $locale) {
      items {
        identifier
        title
        text {
          json
        }
        image {
          url
          title
        }
        includeInAboutSap
      }
    }

    aboutCollection(limit: 1, locale: $locale) {
      items {
        sys {
          id
        }
        title
        text {
          json
        }
        image {
          url
          title
          width
          height
        }
      }
    }

    cabealhoSeesCollection(limit: 1, locale: $locale) {
      items {
        sys {
          id
        }
        title
        description
      }
    }

    partnersCollection(limit: ${CONTENTFUL_COLLECTION_LIMIT}, locale: $locale, order: order_ASC) {
      items {
        sys {
          id
        }
        name
        description
        image {
          url
          title
          width
          height
        }
      }
    }
  }
`;

const GET_ABOUT_PAGE = `
  query GetAboutPage($locale: String!) {
    secaoSobreCollection(limit: ${CONTENTFUL_COLLECTION_LIMIT}, locale: $locale) {
      items {
        identifier
        title
        text {
          json
        }
        image {
          url
          title
        }
        includeInAboutSap
      }
    }

    aboutCollection(limit: 1, locale: $locale) {
      items {
        sys {
          id
        }
        title
        text {
          json
        }
        image {
          url
          title
          width
          height
        }
      }
    }

    partnersCollection(limit: ${CONTENTFUL_COLLECTION_LIMIT}, locale: $locale, order: order_ASC) {
      items {
        sys {
          id
        }
        name
        description
        image {
          url
          title
          width
          height
        }
      }
    }
  }
`;

const GET_GLOSSARY_PAGE = `
  query GetGlossaryPage($locale: String!) {
    glossaryCollection(limit: ${CONTENTFUL_COLLECTION_LIMIT}, locale: $locale, order: term_ASC) {
      items {
        sys {
          id
        }
        term
        definition
        tags
      }
    }
  }
`;

const HOME_TAB_ORDER = [
  {
    identifier: "sociedade-e-comunidades",
    title: "Sociedade e comunidades",
  },
  {
    identifier: "tecnicos-e-pesquisadores",
    title: "Técnicos e pesquisadores",
  },
  {
    identifier: "gestao-publica",
    title: "Gestão pública",
  },
] as const;

/** As abas de "Para quem é o SEDES?", na ordem do design e com o título do código. */
function orderTabs(items: TabsSectionI[]): TabsSectionI[] {
  return HOME_TAB_ORDER.reduce<TabsSectionI[]>((acc, tabConfig) => {
    const tab = items.find((item) => item.identifier === tabConfig.identifier);

    if (!tab) {
      return acc;
    }

    acc.push({
      ...tab,
      title: tabConfig.title,
    });

    return acc;
  }, []);
}

interface HomeContentResponse {
  bannerCollection: { items: Array<IMainBanner | null> };
  aboutCollection: { items: Array<AboutSectionI | null> };
  cabealhoSeesCollection: { items: Array<SectionHeaderI | null> };
  partnersCollection: { items: Array<PartnerI | null> };
  secaoSobreCollection: { items: Array<TabsSectionI | null> };
}

interface AboutPageResponse {
  secaoSobreCollection: { items: Array<TabsSectionI | null> };
  aboutCollection: { items: Array<AboutSectionI | null> };
  partnersCollection: { items: Array<PartnerI | null> };
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

interface GlossaryEntry {
  sys: { id: string };
  term: string;
  definition: string;
  tags?: string[] | null;
}

interface GlossaryPageResponse {
  glossaryCollection: {
    items: Array<GlossaryEntry | null>;
  };
}

export interface GlossaryTermI {
  id: string;
  term: string;
  definition: string;
  /** Campo "Etiquetas" do Contentful; vira os selos do card. */
  tags: string[];
}

export interface HomePageContent {
  mainBanner?: IMainBanner;
  /** Slides do carrossel da home, na ordem do campo "Ordem" do Contentful. */
  banners: IMainBanner[];
  aboutSection?: AboutSectionI;
  partnersHeader?: SectionHeaderI;
  partners: PartnerI[];
  tabs: TabsSectionI[];
}

export interface AboutPageContent {
  tabs: TabsSectionI[];
  team?: AboutSectionI;
  partners: PartnerI[];
}

// Function to map the app locale to Contentful. This may be useful in the future. Currently, all content is mapped to 'en-US' in Contentful.
function mapLocaleToContentful(locale?: string): string {
  return "en-US";
}

export async function getHomePageContent(locale?: string): Promise<HomePageContent | null> {
  try {
    const data = await getContent<HomeContentResponse>(GET_HOME_PAGE, {
      locale: mapLocaleToContentful(locale),
    });
    const bannerItems = data.bannerCollection?.items?.filter(isDefined) ?? [];
    const aboutItems = data.aboutCollection?.items?.filter(isDefined) ?? [];
    const headerItems =
      data.cabealhoSeesCollection?.items?.filter(isDefined) ?? [];
    const partnerItems =
      data.partnersCollection?.items?.filter(isDefined) ?? [];
    const tabsItems = data.secaoSobreCollection?.items?.filter(isDefined) ?? [];

    return {
      mainBanner: bannerItems[0],
      banners: bannerItems,
      aboutSection: aboutItems[0],
      partnersHeader: headerItems[0],
      partners: partnerItems,
      tabs: orderTabs(tabsItems),
    };
  } catch (error) {
    console.error("Erro ao buscar dados da home no Contentful:", error);
    return null;
  }
}

export async function getAboutPageContent(locale?: string): Promise<AboutPageContent | null> {
  try {
    const data = await getContent<AboutPageResponse>(GET_ABOUT_PAGE, {
      locale: mapLocaleToContentful(locale),
    });

    return {
      tabs: orderTabs(
        data.secaoSobreCollection?.items?.filter(isDefined) ?? [],
      ),
      team: data.aboutCollection?.items?.filter(isDefined)?.[0],
      partners: data.partnersCollection?.items?.filter(isDefined) ?? [],
    };
  } catch (error) {
    console.error("Erro ao buscar dados da página Sobre o SEDES:", error);
    return null;
  }
}

export async function getGlossaryTerms(locale?: string): Promise<GlossaryTermI[]> {
  try {
    const data = await getContent<GlossaryPageResponse>(GET_GLOSSARY_PAGE, {
      locale: mapLocaleToContentful(locale),
    });

    return (
      data.glossaryCollection?.items?.filter(isDefined).map((item) => ({
        id: item.sys.id,
        term: item.term,
        definition: item.definition,
        tags: item.tags ?? [],
      })) ?? []
    );
  } catch (error) {
    console.error("Erro ao buscar termos do glossário no Contentful:", error);
    return [];
  }
}
