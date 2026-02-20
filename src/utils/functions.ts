import { getContent } from "./contentful";
import { AboutSectionI } from "./interfaces";
import { GET_HOME_PAGE } from "./queries";

interface AboutContent {
  aboutCollection: { items: AboutSectionI[] };
}

export const getHomePageContent = async (): Promise<AboutSectionI | null> => {
  try {
    const { aboutCollection } = await getContent<AboutContent>(GET_HOME_PAGE);
    return aboutCollection.items[0] ?? null;
  } catch (error) {
    console.error("Erro ao buscar dados do Contentful:", error);
    return null;
  }
};