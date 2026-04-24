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
  query GetFooterPage {
    footerCollection {
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
  query GetHomePage {
    bannerCollection(limit: 1) {
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

    secaoSobreCollection {
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

    aboutCollection(limit: 1) {
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

    cabealhoSeesCollection(limit: 1) {
      items {
        sys {
          id
        }
        title
        description
      }
    }

    partnersCollection {
      items {
        sys {
          id
        }
        name
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
  query GetAboutPage {
    secaoSobreCollection(where: { includeInAboutSap: true }) {
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

    cabealhoSeesCollection(limit: 1) {
      items {
        sys {
          id
        }
        title
        description
      }
    }

    partnersCollection {
      items {
        sys {
          id
        }
        name
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
    items: FooterEntry[];
  };
}

interface FooterEntry {
  sys: { id: string };
  name: string;
  path: string;
  appears: boolean;
}

interface HomeContentResponse {
  bannerCollection: { items: IMainBanner[] };
  aboutCollection: { items: AboutSectionI[] };
  cabealhoSeesCollection: { items: SectionHeaderI[] };
  partnersCollection: { items: PartnerI[] };
  secaoSobreCollection: { items: TabsSectionI[] };
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
    items: ContentfulAboutSectionEntry[];
  };
  cabealhoSeesCollection: {
    items: SectionHeaderI[];
  };
  partnersCollection: {
    items: PartnerI[];
  };
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

function mapFooterItem(item: FooterEntry): FooterI {
  return {
    id: item.sys.id,
    name: item.name,
    path: item.path,
    appears: item.appears,
  };
}

export async function getFooterContent(): Promise<FooterI[]> {
  try {
    const data = await getContent<FooterContentResponse>(GET_FOOTER_PAGE);

    return data.footerCollection?.items.map(mapFooterItem) ?? [];
  } catch (error) {
    console.error("Erro ao buscar footer no Contentful:", error);
    return [];
  }
}

export async function getHomePageContent(): Promise<HomePageContent | null> {
  try {
    const data = await getContent<HomeContentResponse>(GET_HOME_PAGE);

    return {
      mainBanner: data.bannerCollection?.items[0],
      aboutSection: data.aboutCollection?.items[0],
      partnersHeader: data.cabealhoSeesCollection?.items[0],
      partners: data.partnersCollection?.items ?? [],
      tabs: HOME_TAB_ORDER.reduce<TabsSectionI[]>((acc, tabConfig) => {
        const tab = data.secaoSobreCollection?.items.find(
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

export async function getAboutPageContent(): Promise<AboutPageContent | null> {
  try {
    const data = await getContent<AboutPageResponse>(GET_ABOUT_PAGE);
    const allSections = data.secaoSobreCollection?.items ?? [];
    const heroEntry = allSections.find(
      (section) => section.identifier === ABOUT_HERO_IDENTIFIER,
    );
    const aboutEntries = ABOUT_SECTION_ORDER.map((identifier) =>
      allSections.find((section) => section.identifier === identifier),
    ).filter((section): section is NonNullable<typeof section> =>
      Boolean(section),
    );

    const partnersHeader = data.cabealhoSeesCollection?.items?.[0];
    const partners = data.partnersCollection?.items ?? [];

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
    console.error("Erro ao buscar dados da página Sobre o SAP:", error);
    return null;
  }
}
