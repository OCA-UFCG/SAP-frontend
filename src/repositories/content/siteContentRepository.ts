import {
  CONTENTFUL_COLLECTION_LIMIT,
  getContent,
} from "@/infrastructure/contentful/client";
import type { Document } from "@contentful/rich-text-types";
import {
  AboutSectionI,
  IMainBanner,
  PartnerI,
  SectionHeaderI,
  StatCardI,
  TabsSectionI,
  ThematicAxisI,
  TimelineMilestoneI,
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

// O tipo "Sobre e Glossário – Seção" reaproveita o id `planoAcaoBrasileiro`, um
// tipo vazio da home antiga: o espaço do Contentful está no limite de tipos.
// Pelo mesmo motivo, "Sobre – Eixo do PAB" usa o id `projects` e "Sobre –
// Rótulo e valor", o `statCard`.
const ABOUT_SECTION_FIELDS = `
  identifier
  title
  text {
    json
  }
  imagesCollection(limit: 3) {
    items {
      url
      title
    }
  }
  itemsCollection(limit: 12) {
    items {
      __typename
      ... on StatCard {
        label
        value
      }
      ... on AboutMilestone {
        date
        title
        description
      }
      ... on Projects {
        title
        description
        actionsCount
        executor
        executorActionsCount
        partners
        isSedesAxis
      }
      ... on SecaoSobre {
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
  }
`;

const GET_ABOUT_PAGE = `
  query GetAboutPage($locale: String!) {
    planoAcaoBrasileiroCollection(limit: 12, locale: $locale) {
      items {
        ${ABOUT_SECTION_FIELDS}
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

// Em query separada: sem o cabeçalho, os termos continuam chegando.
const GET_GLOSSARY_HEADER = `
  query GetGlossaryHeader($locale: String!) {
    planoAcaoBrasileiroCollection(limit: 1, locale: $locale, where: { identifier: "glossario" }) {
      items {
        title
        text {
          json
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

type AboutSectionItem =
  | ({ __typename: "StatCard" } & StatCardI)
  | ({ __typename: "AboutMilestone" } & TimelineMilestoneI)
  | ({ __typename: "Projects" } & Omit<ThematicAxisI, "partners" | "isSedesAxis"> & {
      partners?: string[] | null;
      isSedesAxis?: boolean | null;
    })
  | ({ __typename: "SecaoSobre" } & TabsSectionI);

interface AboutPageResponse {
  planoAcaoBrasileiroCollection: {
    items: Array<{
      identifier: AboutSectionId;
      title: string;
      text?: { json: Document } | null;
      imagesCollection?: { items: Array<{ url?: string | null; title?: string | null } | null> } | null;
      itemsCollection?: { items: Array<AboutSectionItem | null> } | null;
    } | null>;
  };
  partnersCollection: { items: Array<PartnerI | null> };
}

interface GlossaryHeaderResponse {
  planoAcaoBrasileiroCollection: {
    items: Array<{ title: string; text?: { json: Document } | null } | null>;
  };
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

/** Os blocos da página "Sobre Nós", de cima para baixo. */
export type AboutSectionId =
  | "topo"
  | "pab"
  | "grupo-de-trabalho"
  | "eixos"
  | "para-quem"
  | "modulos"
  | "equipe"
  | "instituicoes";

/** Uma entrada "Sobre – Seção" com os itens já separados pelo tipo. */
export interface AboutPageSectionI {
  title: string;
  text?: { json: Document };
  images: Array<{ url: string; title?: string }>;
  /** Números do PAB ou linhas da equipe ("Sobre – Rótulo e valor"). */
  pairs: StatCardI[];
  milestones: TimelineMilestoneI[];
  axes: ThematicAxisI[];
  tabs: TabsSectionI[];
}

export interface AboutPageContent {
  sections: Partial<Record<AboutSectionId, AboutPageSectionI>>;
  partners: PartnerI[];
}

export interface GlossaryHeaderI {
  title: string;
  text?: { json: Document };
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

    const sections: AboutPageContent["sections"] = {};
    for (const section of data.planoAcaoBrasileiroCollection?.items ?? []) {
      if (!section) continue;
      const items = section.itemsCollection?.items?.filter(isDefined) ?? [];
      sections[section.identifier] = {
        title: section.title,
        text: section.text ?? undefined,
        images: (section.imagesCollection?.items ?? []).flatMap((image) =>
          image?.url ? [{ url: image.url, title: image.title ?? undefined }] : [],
        ),
        pairs: items.flatMap((item) =>
          item.__typename === "StatCard"
            ? [{ label: item.label, value: item.value }]
            : [],
        ),
        milestones: items.flatMap((item) =>
          item.__typename === "AboutMilestone"
            ? [{ date: item.date, title: item.title, description: item.description }]
            : [],
        ),
        axes: items.flatMap((item) =>
          item.__typename === "Projects"
            ? [{
                title: item.title,
                description: item.description ?? undefined,
                executor: item.executor,
                executorActionsCount: item.executorActionsCount,
                actionsCount: item.actionsCount,
                partners: item.partners ?? [],
                isSedesAxis: item.isSedesAxis ?? false,
              }]
            : [],
        ),
        tabs: items.flatMap((item) =>
          item.__typename === "SecaoSobre"
            ? [{
                identifier: item.identifier,
                title: item.title,
                text: item.text,
                image: item.image,
                includeInAboutSap: item.includeInAboutSap,
              }]
            : [],
        ),
      };
    }

    return {
      sections,
      partners: data.partnersCollection?.items?.filter(isDefined) ?? [],
    };
  } catch (error) {
    console.error("Erro ao buscar dados da página Sobre o SEDES:", error);
    return null;
  }
}

/** Título e frase do topo do glossário (entrada "glossario"). */
export async function getGlossaryHeader(locale?: string): Promise<GlossaryHeaderI | null> {
  try {
    const data = await getContent<GlossaryHeaderResponse>(GET_GLOSSARY_HEADER, {
      locale: mapLocaleToContentful(locale),
    });
    const header = data.planoAcaoBrasileiroCollection?.items?.find(isDefined);
    return header ? { title: header.title, text: header.text ?? undefined } : null;
  } catch (error) {
    console.error("Erro ao buscar o topo do glossário no Contentful:", error);
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
