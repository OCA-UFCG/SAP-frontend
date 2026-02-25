import { getContent } from '../utils/contentful';
import { GET_HOME_PAGE } from '../utils/queries';
import { AboutSectionI } from '../utils/interfaces';
import { AboutSection } from '../components/AboutSection/AboutSection';
import MapComponent from '@/components/Map/MapComponent';

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
        <div className="bg-white-700 mx-auto my-5 h-[690px] w-[60%] flex z-10 my-20 ">
          <MapComponent
            center={[-7.22, -35.88]}
            zoom={10}
          />
        </div>
        {aboutCollection?.items && <AboutSection content={content} />}
      </main>
    </div>
  );
}
