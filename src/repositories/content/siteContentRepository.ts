import { getContent } from "@/infrastructure/contentful/client";
import type { Document } from "@contentful/rich-text-types";
import {
  AboutSectionI,
  FooterI,
  IMainBanner,
  PartnerI,
  SectionHeaderI,
  TabsSectionI,
} from "@/utils/interfaces";
import { normalizeContentfulImage } from "@/utils/functions";

const GET_FOOTER_PAGE = `
  query GetFooterPage($locale: String!) {
    footerCollection(locale: $locale) {
      items {
        sys {
          id
        }
        name
        path
        appears
      }
    }
  }
`;

const GET_HOME_PAGE = `
  query GetHomePage($locale: String!) {
    bannerCollection(limit: 1, locale: $locale) {
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

    secaoSobreCollection(locale: $locale) {
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

    partnersCollection(locale: $locale, order: order_ASC) {
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
    secaoSobreCollection(locale: $locale, where: { includeInAboutSap: true }) {
      items {
        sys {
          id
        }
        identifier
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

    partnersCollection(locale: $locale, order: order_ASC) {
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
    glossaryCollection(locale: $locale, order: term_ASC) {
      items {
        sys {
          id
        }
        term
        definition
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

const ABOUT_HERO_IDENTIFIER = "sobre-nos";
const ABOUT_SECTION_ORDER = ["sobre-seca", "sobre-desertificacao"] as const;

interface FooterContentResponse {
  footerCollection: {
    items: Array<FooterEntry | null>;
  };
}

interface FooterEntry {
  sys: { id: string };
  name: string;
  path: string;
  appears: boolean;
}

interface HomeContentResponse {
  bannerCollection: { items: Array<IMainBanner | null> };
  aboutCollection: { items: Array<AboutSectionI | null> };
  cabealhoSeesCollection: { items: Array<SectionHeaderI | null> };
  partnersCollection: { items: Array<PartnerI | null> };
  secaoSobreCollection: { items: Array<TabsSectionI | null> };
}

interface ContentfulAboutSectionEntry {
  sys: {
    id: string;
  };
  identifier: string;
  title: string;
  text: {
    json: Document;
  };
  image: {
    url: string;
    title?: string;
    width?: number;
    height?: number;
  };
}

interface AboutPageResponse {
  secaoSobreCollection: {
    items: Array<ContentfulAboutSectionEntry | null>;
  };
  cabealhoSeesCollection: {
    items: Array<SectionHeaderI | null>;
  };
  partnersCollection: {
    items: Array<PartnerI | null>;
  };
}

function isDefined<T>(value: T | null | undefined): value is T {
  return value != null;
}

interface GlossaryEntry {
  sys: { id: string };
  term: string;
  definition: string;
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
}

export interface HomePageContent {
  mainBanner?: IMainBanner;
  aboutSection?: AboutSectionI;
  partnersHeader?: SectionHeaderI;
  partners: PartnerI[];
  tabs: TabsSectionI[];
}

export interface AboutPageContent {
  hero?: {
    title: string;
    description: Document;
    imageUrl: string;
  };
  aboutSections: Array<{
    title: string;
    text: Document;
    imageUrl: string;
    imageAlt: string;
  }>;
  partnersHeader: SectionHeaderI;
  partners: PartnerI[];
}

// Function to map the app locale to Contentful. This may be useful in the future. Currently, all content is mapped to 'en-US' in Contentful.
function mapLocaleToContentful(locale?: string): string {
  return "en-US";
}

function mapFooterItem(item: FooterEntry): FooterI {
  return {
    id: item.sys.id,
    name: item.name,
    path: item.path,
    appears: item.appears,
  };
}

export async function getFooterContent(locale?: string): Promise<FooterI[]> {
  try {
    const data = await getContent<FooterContentResponse>(GET_FOOTER_PAGE, {
      locale: mapLocaleToContentful(locale),
    });

    return (
      data.footerCollection?.items.filter(isDefined).map(mapFooterItem) ?? []
    );
  } catch (error) {
    console.error("Erro ao buscar footer no Contentful:", error);
    return [];
  }
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
      aboutSection: aboutItems[0],
      partnersHeader: headerItems[0],
      partners: partnerItems,
      tabs: HOME_TAB_ORDER.reduce<TabsSectionI[]>((acc, tabConfig) => {
        const tab = tabsItems.find(
          (item) => item.identifier === tabConfig.identifier,
        );

        if (!tab) {
          return acc;
        }

        acc.push({
          ...tab,
          title: tabConfig.title,
        });

        return acc;
      }, []),
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
    const allSections =
      data.secaoSobreCollection?.items?.filter(isDefined) ?? [];
    const heroEntry = allSections.find(
      (section) => section.identifier === ABOUT_HERO_IDENTIFIER,
    );
    const aboutEntries = ABOUT_SECTION_ORDER.map((identifier) =>
      allSections.find((section) => section.identifier === identifier),
    ).filter((section): section is NonNullable<typeof section> =>
      Boolean(section),
    );

    const partnersHeader =
      data.cabealhoSeesCollection?.items?.filter(isDefined)?.[0] ?? null;
    const partners = data.partnersCollection?.items?.filter(isDefined) ?? [];

    if (!partnersHeader) {
      return null;
    }

    return {
      hero: heroEntry
        ? {
            title: heroEntry.title,
            description: heroEntry.text.json,
            imageUrl: normalizeContentfulImage(heroEntry.image.url),
          }
        : undefined,
      aboutSections: aboutEntries.map((entry) => ({
        title: entry.title,
        text: entry.text.json,
        imageUrl: normalizeContentfulImage(entry.image.url),
        imageAlt: entry.image.title ?? entry.title,
      })),
      partnersHeader,
      partners,
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
      })) ?? []
    );
  } catch (error) {
    console.error("Erro ao buscar termos do glossário no Contentful:", error);
    return [];
  }
}
