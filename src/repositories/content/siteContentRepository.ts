import { getContent } from "@/infrastructure/contentful/client";
import type { Document } from "@contentful/rich-text-types";
import {
  AboutSectionI,
  ActionPlanSectionI,
  FooterI,
  IMainBanner,
  PartnerI,
  PlatformModulesSectionI,
  SectionHeaderI,
  TabsSectionI,
  ThematicAxesSectionI,
  WorkingGroupSectionI,
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

    partnersCollection(locale: $locale) {
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

// TODO: this content type doesn't exist in Contentful yet. Kept as its own
// query (instead of folded into GET_HOME_PAGE) so that until it's created,
// its "unknown field" 400 only misses this one section instead of failing
// the whole home page fetch.
const GET_ACTION_PLAN_SECTION = `
  query GetActionPlanSection($locale: String!) {
    planoAcaoBrasileiroCollection(limit: 1, locale: $locale) {
      items {
        title
        text {
          json
        }
        cardsCollection {
          items {
            value
            label
          }
        }
      }
    }
  }
`;

// TODO: this content type doesn't exist in Contentful yet either. Isolated
// for the same reason as GET_ACTION_PLAN_SECTION above.
const GET_THEMATIC_AXES_SECTION = `
  query GetThematicAxesSection($locale: String!) {
    eixosTematicosCollection(limit: 1, locale: $locale) {
      items {
        title
        eixoCollection {
          items {
            title
            executor
            executorActionsCount
            partners
            actionsCount
            isSapAxis
          }
        }
      }
    }
  }
`;

// TODO: this content type doesn't exist in Contentful yet either. Isolated
// for the same reason as GET_ACTION_PLAN_SECTION above.
const GET_WORKING_GROUP_SECTION = `
  query GetWorkingGroupSection($locale: String!) {
    grupoDeTrabalhoCollection(limit: 1, locale: $locale) {
      items {
        eyebrow
        title
        text {
          json
        }
        marcosCollection {
          items {
            date
            title
            description
            isCurrent
          }
        }
      }
    }
  }
`;

// TODO: this content type doesn't exist in Contentful yet either. Isolated
// for the same reason as GET_ACTION_PLAN_SECTION above.
const GET_PLATFORM_MODULES_SECTION = `
  query GetPlatformModulesSection($locale: String!) {
    modulosPlataformaCollection(limit: 1, locale: $locale) {
      items {
        title
        moduloCollection {
          items {
            title
            description
          }
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

    partnersCollection(locale: $locale) {
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

interface ActionPlanSectionResponse {
  planoAcaoBrasileiroCollection: {
    items: Array<ContentfulActionPlanEntry | null>;
  };
}

interface ContentfulActionPlanEntry {
  title: string;
  text: {
    json: Document;
  };
  cardsCollection?: {
    items: Array<{ value: string; label: string } | null>;
  };
}

interface ThematicAxesSectionResponse {
  eixosTematicosCollection: {
    items: Array<ContentfulThematicAxesEntry | null>;
  };
}

interface ContentfulThematicAxesEntry {
  title: string;
  eixoCollection?: {
    items: Array<ContentfulThematicAxisEntry | null>;
  };
}

interface ContentfulThematicAxisEntry {
  title: string;
  executor: string;
  executorActionsCount: number;
  partners: string[];
  actionsCount: number;
  isSapAxis?: boolean;
}

interface WorkingGroupSectionResponse {
  grupoDeTrabalhoCollection: {
    items: Array<ContentfulWorkingGroupEntry | null>;
  };
}

interface ContentfulWorkingGroupEntry {
  eyebrow: string;
  title: string;
  text: {
    json: Document;
  };
  marcosCollection?: {
    items: Array<ContentfulTimelineMilestoneEntry | null>;
  };
}

interface ContentfulTimelineMilestoneEntry {
  date: string;
  title: string;
  description: string;
  isCurrent?: boolean;
}

interface PlatformModulesSectionResponse {
  modulosPlataformaCollection: {
    items: Array<ContentfulPlatformModulesEntry | null>;
  };
}

interface ContentfulPlatformModulesEntry {
  title: string;
  moduloCollection?: {
    items: Array<ContentfulPlatformModuleEntry | null>;
  };
}

interface ContentfulPlatformModuleEntry {
  title: string;
  description: string;
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

export interface HomePageContent {
  mainBanner?: IMainBanner;
  aboutSection?: AboutSectionI;
  partnersHeader?: SectionHeaderI;
  partners: PartnerI[];
  tabs: TabsSectionI[];
  actionPlan?: ActionPlanSectionI;
  thematicAxes?: ThematicAxesSectionI;
  workingGroup?: WorkingGroupSectionI;
  platformModules?: PlatformModulesSectionI;
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

async function getActionPlanSectionContent(
  locale?: string,
): Promise<ActionPlanSectionI | undefined> {
  try {
    const data = await getContent<ActionPlanSectionResponse>(
      GET_ACTION_PLAN_SECTION,
      { locale: mapLocaleToContentful(locale) },
    );
    const actionPlanItem =
      data.planoAcaoBrasileiroCollection?.items?.filter(isDefined)?.[0];

    return (
      actionPlanItem && {
        title: actionPlanItem.title,
        text: actionPlanItem.text,
        stats: actionPlanItem.cardsCollection?.items?.filter(isDefined) ?? [],
      }
    );
  } catch (error) {
    console.error(
      "Erro ao buscar seção do Plano de Ação Brasileiro no Contentful:",
      error,
    );
    return undefined;
  }
}

async function getThematicAxesSectionContent(
  locale?: string,
): Promise<ThematicAxesSectionI | undefined> {
  try {
    const data = await getContent<ThematicAxesSectionResponse>(
      GET_THEMATIC_AXES_SECTION,
      { locale: mapLocaleToContentful(locale) },
    );
    const thematicAxesItem =
      data.eixosTematicosCollection?.items?.filter(isDefined)?.[0];

    if (!thematicAxesItem) {
      return undefined;
    }

    return {
      title: thematicAxesItem.title,
      axes:
        thematicAxesItem.eixoCollection?.items?.filter(isDefined).map(
          (axis) => ({
            title: axis.title,
            executor: axis.executor,
            executorActionsCount: axis.executorActionsCount,
            partners: axis.partners,
            actionsCount: axis.actionsCount,
            isSapAxis: axis.isSapAxis,
          }),
        ) ?? [],
    };
  } catch (error) {
    console.error(
      "Erro ao buscar seção de Eixos Temáticos no Contentful:",
      error,
    );
    return undefined;
  }
}

async function getWorkingGroupSectionContent(
  locale?: string,
): Promise<WorkingGroupSectionI | undefined> {
  try {
    const data = await getContent<WorkingGroupSectionResponse>(
      GET_WORKING_GROUP_SECTION,
      { locale: mapLocaleToContentful(locale) },
    );
    const workingGroupItem =
      data.grupoDeTrabalhoCollection?.items?.filter(isDefined)?.[0];

    if (!workingGroupItem) {
      return undefined;
    }

    return {
      eyebrow: workingGroupItem.eyebrow,
      title: workingGroupItem.title,
      text: workingGroupItem.text,
      milestones:
        workingGroupItem.marcosCollection?.items?.filter(isDefined).map(
          (milestone) => ({
            date: milestone.date,
            title: milestone.title,
            description: milestone.description,
            isCurrent: milestone.isCurrent,
          }),
        ) ?? [],
    };
  } catch (error) {
    console.error(
      "Erro ao buscar seção do Grupo de Trabalho no Contentful:",
      error,
    );
    return undefined;
  }
}

async function getPlatformModulesSectionContent(
  locale?: string,
): Promise<PlatformModulesSectionI | undefined> {
  try {
    const data = await getContent<PlatformModulesSectionResponse>(
      GET_PLATFORM_MODULES_SECTION,
      { locale: mapLocaleToContentful(locale) },
    );
    const platformModulesItem =
      data.modulosPlataformaCollection?.items?.filter(isDefined)?.[0];

    if (!platformModulesItem) {
      return undefined;
    }

    return {
      title: platformModulesItem.title,
      modules:
        platformModulesItem.moduloCollection?.items?.filter(isDefined).map(
          (module) => ({
            title: module.title,
            description: module.description,
          }),
        ) ?? [],
    };
  } catch (error) {
    console.error(
      "Erro ao buscar seção de Módulos da Plataforma no Contentful:",
      error,
    );
    return undefined;
  }
}

export async function getHomePageContent(locale?: string): Promise<HomePageContent | null> {
  try {
    const [data, actionPlan, thematicAxes, workingGroup, platformModules] =
      await Promise.all([
        getContent<HomeContentResponse>(GET_HOME_PAGE, {
          locale: mapLocaleToContentful(locale),
        }),
        getActionPlanSectionContent(locale),
        getThematicAxesSectionContent(locale),
        getWorkingGroupSectionContent(locale),
        getPlatformModulesSectionContent(locale),
      ]);
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
      actionPlan,
      thematicAxes,
      workingGroup,
      platformModules,
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
    console.error("Erro ao buscar dados da página Sobre o SAP:", error);
    return null;
  }
}
