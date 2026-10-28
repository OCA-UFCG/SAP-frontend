import { AboutHero } from "@/components/AboutHero/AboutHero";
import { ActionPlanSection, ThematicAxesSection } from "@/components/ActionPlanSection/ActionPlanSection";
import { WorkingGroupSection } from "@/components/WorkingGroupSection/WorkingGroupSection";
import TabsSection from "@/components/TabSection/TabSection";
import { AboutModulesSection } from "@/components/AboutModulesSection/AboutModulesSection";
import { AboutSection } from "@/components/AboutSection/AboutSection";
import { InstitutionsSection } from "@/components/InstitutionsSection/InstitutionsSection";
import { getAboutPageContent } from "@/repositories/content/siteContentRepository";
import { getTranslations } from "next-intl/server";
import { pageTitleMetadata } from "@/lib/page-metadata";
import {
  MOCK_ACTION_PLAN_CONTENT,
  MOCK_PLATFORM_MODULES_CONTENT,
  MOCK_WORKING_GROUP_CONTENT,
} from "../homePage.mocks";
import { getHomeTextsForLocale } from "../homeTexts";

export const generateMetadata = pageTitleMetadata("about");

export default async function SobreOSedesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [data, homeTexts] = await Promise.all([
    getAboutPageContent(locale),
    getHomeTextsForLocale(locale),
  ]);
  const t = await getTranslations("AboutPage");

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-xl">{t("notFound")}</p>
      </div>
    );
  }

  // As fotos das abas são as do design; o texto continua vindo das traduções
  // (ou do Contentful, quando faltar tradução).
  const tabs = data.tabs.map((tab) => ({
    ...tab,
    image: { url: `/sobre/para-quem-${tab.identifier}.jpg` },
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <div className="grow">
        <AboutHero />
        <ActionPlanSection content={MOCK_ACTION_PLAN_CONTENT} />
        <WorkingGroupSection
          content={MOCK_WORKING_GROUP_CONTENT}
          image="/sobre/grupo-de-trabalho.jpg"
          className="bg-[#F6F7F6]"
        />
        <ThematicAxesSection content={MOCK_ACTION_PLAN_CONTENT} />
        <TabsSection contentData={tabs} />
        <AboutModulesSection
          modules={MOCK_PLATFORM_MODULES_CONTENT.modules}
          texts={homeTexts.tools}
          image="/sobre/modulos-paisagem.jpg"
        />
        {data.team && <AboutSection content={data.team} />}
        <InstitutionsSection partners={data.partners} />
      </div>
    </div>
  );
}
