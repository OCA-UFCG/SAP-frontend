import { getContent } from "../utils/contentful";
import { GET_HOME_PAGE } from "../utils/queries";
import { AboutSectionI, StatusItemI, IMainBanner } from "../utils/interfaces";
import { AboutSection } from "../components/AboutSection/AboutSection";
import { AlertTiers } from "../components/AlertTiers/AlertTiers";
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

  const items: StatusItemI[] = [
    {
      id: "1",
      label: "Sem seca",
      value: 43.3,
      color: "#F0F0D7",
      textColor: "#292829"
    },
    {
      id: "2",
      label: "Observação (Watch)",
      value: 24.5,
      color: "#FECB89",
      textColor: "#292829"

    },
    {
      id: "3",
      label: "Atenção (Warning)",
      value: 6,
      color: "#FC8F23",
      textColor: "#292829"
    },
    {
      id: "4",
      label: "Alerta (Alert)",
      value: 13.2,
      color: "#B52C08",
      textColor: "#F8F7F8"

    },
    {
      id: "6",
      label: "Recuperação Total (Full Recovery)",
      value: 13,
      color: "#B4BA61",
      textColor: "#F8F7F8"

    },
        {
      id: "7",
      label: "Recuperação Parcial (Partial Recovery)",
      value: 13,
      color: "#5B612A",
      textColor: "#F8F7F8"

    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      {mainBannerData && <MainBanner data={mainBannerData} />}
      {aboutData && <AboutSection content={aboutData} />}

      <AlertTiers items={items}></AlertTiers>
    </div>
  );
}