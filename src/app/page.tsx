import { AboutSection } from "../components/AboutSection/AboutSection";
import { MainBanner } from "../components/MainBanner/MainBanner";
import { PartnersSection } from "../components/PartnersSection/PartnersSection";
import TabsSection from "../components/TabSection/TabSection";
import MapSection from "@/components/MapSection/MapSection";
import { getHomePageContent } from "@/repositories/content/siteContentRepository";

export default async function Home() {
  const data = await getHomePageContent();

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        <p>Conteúdo não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="grow">
        {data.mainBanner && <MainBanner data={data.mainBanner} />}

        <MapSection />

        {data.aboutSection && <AboutSection content={data.aboutSection} />}
        {data.tabs.length > 0 && <TabsSection contentData={data.tabs} />}
        {data.partnersHeader && (
          <PartnersSection
            header={data.partnersHeader}
            partners={data.partners}
          />
        )}
      </main>
    </div>
  );
}
