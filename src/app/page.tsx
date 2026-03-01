import { getContent } from "../utils/contentful";
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

  const tabsData = data.secaoSobreCollection?.items ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <main className="grow">
        {mainBannerData && <MainBanner data={mainBannerData} />}
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
