import { getContent } from "../utils/contentful";
import { GET_HOME_PAGE } from "../utils/queries";
import { AboutSectionI, ISectionHeader, IDemonstrationVideo } from "../utils/interfaces";
import { AboutSection } from "../components/AboutSection/AboutSection";
import DemonstrationSection from "../components/DemonstrationSection/DemonstrationSection";

interface HomeContent {
  aboutCollection: { items: AboutSectionI[] };
  cabealhoSeesCollection: { items: ISectionHeader[] };
  secaoDeDemonstracaoCollection: { items: IDemonstrationVideo[] };
}

const getHomePageContent = async (): Promise<HomeContent | null> => {
  try {
    const response = await getContent<HomeContent>(GET_HOME_PAGE);
    console.log("--- DEBUG CONTENTFUL ---");
    console.log("Título do Header:", response?.cabealhoSeesCollection?.items[0]?.title);
    console.log("Link do Vídeo:", response?.secaoDeDemonstracaoCollection?.items[0]?.linkDoVideo);
    console.log("------------------------");
    return response;
  } catch (error) {
    console.error("Erro ao buscar dados do Contentful:", error);
    return null;
  }
};

export default async function Home() {
  const data = await getHomePageContent();

  if (!data?.aboutCollection?.items?.length) {
    return (
      <div className="flex min-h-screen flex-col">
        <p>Conteúdo não encontrado.</p>
      </div>
    );
  }

  const aboutContent = data.aboutCollection.items[0];
  const demoHeader = data.cabealhoSeesCollection?.items[0];
  const demoVideo = data.secaoDeDemonstracaoCollection?.items[0];

  return (
    <div className="flex min-h-screen flex-col">
      {aboutContent && (
        <AboutSection content={aboutContent} />
      )}

      {demoHeader && demoVideo && (
        <DemonstrationSection 
          header={demoHeader} 
          video={demoVideo} 
        />
      )}
    </div>
  );
}