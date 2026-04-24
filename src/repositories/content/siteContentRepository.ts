import { getContent } from "@/infrastructure/contentful/client";
import {
  AboutPageQuery,
  AboutSectionI,
  FooterI,
  IMainBanner,
  PartnerI,
  SecaoSobreI,
  SectionHeaderI,
  TabsSectionI,
} from "@/utils/interfaces";
import {
  GET_ABOUT_PAGE,
  GET_FOOTER_PAGE,
  GET_HOME_PAGE,
} from "@/utils/queries";
import { normalizeContentfulImage } from "@/utils/functions";

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
    description: SecaoSobreI["text"]["json"];
    imageUrl: string;
  };
  aboutSections: Array<{
    title: string;
    text: SecaoSobreI["text"]["json"];
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
    const data = await getContent<AboutPageQuery>(GET_ABOUT_PAGE);
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
