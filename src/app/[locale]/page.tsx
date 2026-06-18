import { AboutSection } from "@/components/AboutSection/AboutSection";
import { MainBanner } from "@/components/MainBanner/MainBanner";
import { PartnersSection } from "@/components/PartnersSection/PartnersSection";
import TabsSection from "@/components/TabSection/TabSection";
import MapSection from "@/components/MapSection/MapSection";
import { getHomePageContent } from "@/repositories/content/siteContentRepository";
import { getTranslations } from "next-intl/server";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const data = await getHomePageContent(locale);
  const t = await getTranslations("HomePage");

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        <p>{t("contentNotFound")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="grow">
        {data.mainBanner && <MainBanner data={data.mainBanner} />}

        <MapSection />

        {data.tabs.length > 0 && <TabsSection contentData={data.tabs} />}
        {data.aboutSection && <AboutSection content={data.aboutSection} />}
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
