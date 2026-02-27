import { getContent } from "../utils/contentful";
import { GET_HOME_PAGE } from "../utils/queries";
import {
  AboutSectionI,
  IMainBanner,
  PartnerI,
  SectionHeaderI,
} from "../utils/interfaces";
import { AboutSection } from "../components/AboutSection/AboutSection";
import { Footer} from "@/components/Footer/Footer"
import { FooterI } from "../utils/interfaces";
import { MainBanner } from "../components/MainBanner/MainBanner";
import { PartnersSection } from "../components/PartnersSection/PartnersSection";

interface HomeContent {
  bannerCollection: { items: IMainBanner[] };
  aboutCollection: { items: AboutSectionI[] };
  cabealhoSeesCollection: { items: SectionHeaderI[] };
  partnersCollection: { items: PartnerI[] };
  footerCollection: { items: FooterI[] };
}

const getHomePageContent = async (): Promise<HomeContent | null> => {
  try {
    const response = await getContent<HomeContent>(GET_HOME_PAGE);
    return response;
  } catch (error) {
    console.error('Erro ao buscar dados do Contentful:', error);
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

  const { footerCollection } = data;
  const footerContent = footerCollection?.items || [];
  const mainBannerData = data.bannerCollection?.items[0];
  const aboutData = data.aboutCollection?.items[0];
  const partnersHeaderData = data.cabealhoSeesCollection?.items[0];
  const partnersData = data.partnersCollection?.items ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <main className="grow">
        {mainBannerData && <MainBanner data={mainBannerData} />}
        {aboutData && <AboutSection content={aboutData} />}
        {partnersHeaderData && (
          <PartnersSection header={partnersHeaderData} partners={partnersData} />
        )}
      </main>
      {footerCollection?.items && <Footer content={footerContent} />}
    </div>
  );
}