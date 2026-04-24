import { getContent } from "@/infrastructure/contentful/client";
import { GET_HOME_PAGE } from "../utils/queries";
import {
  AboutSectionI,
  IMainBanner,
  PartnerI,
  SectionHeaderI,
  TabsSectionI,
} from "../utils/interfaces";
import { AboutSection } from "../components/AboutSection/AboutSection";
import { MainBanner } from "../components/MainBanner/MainBanner";
import { PartnersSection } from "../components/PartnersSection/PartnersSection";
import TabsSection from "../components/TabSection/TabSection";
import MapSection from "@/components/MapSection/MapSection";

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

interface HomeContent {
  bannerCollection: { items: IMainBanner[] };
  aboutCollection: { items: AboutSectionI[] };
  cabealhoSeesCollection: { items: SectionHeaderI[] };
  partnersCollection: { items: PartnerI[] };
  secaoSobreCollection: { items: TabsSectionI[] };
}

const getHomePageContent = async (): Promise<HomeContent | null> => {
  try {
    const response = await getContent<HomeContent>(GET_HOME_PAGE);
    return response;
  } catch (error) {
    console.error("Erro ao buscar dados do Contentful:", error);
    return null;
  }
};

export default async function Home() {
  const data = await getHomePageContent();

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        <p>Conteúdo não encontrado.</p>
      </div>
    );
  }

  const mainBannerData = data.bannerCollection?.items[0];
  const aboutData = data.aboutCollection?.items[0];
  const partnersHeaderData = data.cabealhoSeesCollection?.items[0];
  const partnersData = data.partnersCollection?.items ?? [];

  const tabsData = HOME_TAB_ORDER.reduce<TabsSectionI[]>((acc, tabConfig) => {
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
  }, []);

  return (
    <div className="flex min-h-screen flex-col">
      <main className="grow">
        {mainBannerData && <MainBanner data={mainBannerData} />}

        <MapSection />

        {aboutData && <AboutSection content={aboutData} />}
        {tabsData.length > 0 && <TabsSection contentData={tabsData} />}
        {partnersHeaderData && (
          <PartnersSection
            header={partnersHeaderData}
            partners={partnersData}
          />
        )}
      </main>
    </div>
  );
}
