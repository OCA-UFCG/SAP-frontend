import { getContent } from "./contentful";
import { AboutSectionI } from "./interfaces";
import { GET_SOBRE_NOS_HOMEPAGE } from "./queries";

interface AboutContent {
  aboutCollection: { items: AboutSectionI[] };
}

export const getAboutSectionData = async (): Promise<AboutSectionI | null> => {
  try {
    const { aboutCollection } = await getContent<AboutContent>(GET_SOBRE_NOS_HOMEPAGE);
    return aboutCollection.items[0] ?? null;
  } catch (error) {
    console.error("Erro ao buscar dados do Contentful:", error);
    return null;
  }
};
