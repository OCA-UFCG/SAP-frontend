import { getContent } from '../utils/contentful';
import { GET_HOME_PAGE } from '../utils/queries';
import { AboutSectionI } from '../utils/interfaces';
import { AboutSection } from '../components/AboutSection/AboutSection';

interface HomeContent {
  aboutCollection: { items: AboutSectionI[] };
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
import { Header } from '@/components/Header/Header';
import { ISections } from '@/utils/interfaces';

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


  return (
    <div className="flex min-h-screen flex-col w-full h-full bg-white">
      <main className="flex min-h-screen w-full flex-col items-center justify-center bg-grey sm:items-start">
        
        {aboutCollection?.items && <AboutSection content={content} />}
      </main>
    </div>
  );
}
