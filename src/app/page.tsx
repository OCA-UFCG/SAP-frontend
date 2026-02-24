import { getContent } from "../utils/contentful";
import { GET_HOME_PAGE } from "../utils/queries";
import { AboutSectionI } from "../utils/interfaces";
import { AboutSection } from "../components/AboutSection/AboutSection";

interface HomeContent {
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
import { Header } from "@/components/NavigationMenu/NavigationMenu";
import { ISections } from "@/utils/interfaces";

export default async function Home() {
  const data = await getHomePageContent();

  // early return pra garantir que data não seja null
  if (!data?.aboutCollection?.items?.length) {
    return (
      <div className="flex min-h-screen flex-col">
        <p>Conteúdo não encontrado.</p>
      </div>
    );
  }

  const { aboutCollection } = data;
  const content = aboutCollection.items[0];

  const headerContent: ISections = {
  "home-section": {
    id: "1",
    name: "Home",
    path: "/",
    appears: true
  },
  "map-section": {
    id: "2",
    name: "Mapa",
    path: "/mock",
    appears: true,
  },
  "about-section": {
    id: "3",
    name: "Sobre o Sap",
    path: "/mock",
    appears: true
  },
  "contact-section": {
    id: "4",
    name: "Contatos",
    path: "/mock",
    appears: true
  }
};
  return (
    <div className="flex min-h-screen flex-col">
      <Header content={Object.values(headerContent)}></Header>
      {aboutCollection?.items && (
        <AboutSection content={content} />
      )}
    </div>
  );
}
