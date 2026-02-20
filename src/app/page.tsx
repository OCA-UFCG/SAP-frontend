import { getContent } from "../utils/contentful";
import { GET_HOME_PAGE } from "../utils/queries";
import { AboutSectionI } from "../utils/interfaces";
import { AboutSection } from "../components/AboutSection/AboutSection"

interface AboutContent {
  aboutCollection: { items: AboutSectionI[] };
}

const getHomePageContent = async (): Promise<AboutSectionI | null> => {
  try {
    const { aboutCollection } = await getContent<AboutContent>(GET_HOME_PAGE);
    return aboutCollection.items[0] ?? null;
  } catch (error) {
    console.error("Erro ao buscar dados do Contentful:", error);
    return null;
  }
};

export default async function Home() {
  const content = await getHomePageContent();

  return (
    <div className="flex min-h-screen flex-col">
      {content ? (
        <AboutSection content={content} />
      ) : (
        <p>Conteúdo não encontrado.</p>
      )}
    </div>
  );
}