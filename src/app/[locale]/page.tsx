import { AboutSection } from "@/components/AboutSection/AboutSection";
import { MainBanner } from "@/components/MainBanner/MainBanner";
import { PartnersSection } from "@/components/PartnersSection/PartnersSection";
import TabsSection from "@/components/TabSection/TabSection";
import MapSection from "@/components/MapSection/MapSection";
import { ActionPlanSection } from "@/components/ActionPlanSection/ActionPlanSection";
import { ThematicAxesSection } from "@/components/ThematicAxesSection/ThematicAxesSection";
import { WorkingGroupSection } from "@/components/WorkingGroupSection/WorkingGroupSection";
import { PlatformModulesSection } from "@/components/PlatformModulesSection/PlatformModulesSection";
import { getHomePageContent } from "@/repositories/content/siteContentRepository";
import { getTranslations } from "next-intl/server";
import {
  MOCK_ACTION_PLAN_CONTENT,
  MOCK_PLATFORM_MODULES_CONTENT,
  MOCK_THEMATIC_AXES_CONTENT,
  MOCK_WORKING_GROUP_CONTENT,
} from "./homePage.mocks";

const SHOW_MAP_SECTION = false;

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

        {SHOW_MAP_SECTION && <MapSection />}

        <ActionPlanSection
          id="plano-de-acao-brasileiro"
          content={MOCK_ACTION_PLAN_CONTENT}
        />
        <ThematicAxesSection content={MOCK_THEMATIC_AXES_CONTENT} />
        <WorkingGroupSection
          id="grupo-de-trabalho"
          content={MOCK_WORKING_GROUP_CONTENT}
          className="bg-[#F6F7F6]"
        />
        <PlatformModulesSection
          id="a-plataforma"
          content={MOCK_PLATFORM_MODULES_CONTENT}
        />

        {data.tabs.length > 0 && (
          <div id="usuarios" className="w-full scroll-mt-16.5">
            <TabsSection contentData={data.tabs} />
          </div>
        )}

        {data.aboutSection && (
          <AboutSection id="financiamento" content={data.aboutSection} />
        )}
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
