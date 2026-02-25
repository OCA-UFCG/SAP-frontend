import { getContent } from "../utils/contentful";
import { GET_HOME_PAGE } from "../utils/queries";
import { AboutSectionI, IMainBanner } from "../utils/interfaces";
import { AboutSection } from "../components/AboutSection/AboutSection";
import { MainBanner } from "../components/MainBanner/MainBanner";

interface HomeContent {
  bannerCollection: { items: IMainBanner[] };
  aboutCollection: { items: AboutSectionI[] };
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

  return (
    <div className="flex min-h-screen flex-col">
      {mainBannerData && <MainBanner data={mainBannerData} />}
      {aboutData && <AboutSection content={aboutData} />}
    </div>
  );
}