import { MainBanner } from "@/components/MainBanner/MainBanner";
import { BigNumbersSection } from "@/components/BigNumbersSection/BigNumbersSection";
import { NewsSection } from "@/components/NewsSection/NewsSection";
import { PlatformModulesSection } from "@/components/PlatformModulesSection/PlatformModulesSection";
import { PublicPolicySection } from "@/components/PublicPolicySection/PublicPolicySection";
import { UseCasesSection } from "@/components/UseCasesSection/UseCasesSection";
import { InstitutionsSection } from "@/components/InstitutionsSection/InstitutionsSection";
import { getHomePageContent } from "@/repositories/content/siteContentRepository";
import { getTranslations } from "next-intl/server";
import {
  MOCK_NEWS_CONTENT,
  MOCK_PLATFORM_MODULES_CONTENT,
} from "./homePage.mocks";

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

  // Os ids das seções são os destinos do menu "Home" do topo (layout.tsx).
  return (
    <div className="flex min-h-screen flex-col">
      <main className="grow">
        <MainBanner banners={data.banners} />
        <BigNumbersSection />
        <NewsSection id="novidades" items={MOCK_NEWS_CONTENT} />
        <PlatformModulesSection
          id="a-plataforma"
          content={MOCK_PLATFORM_MODULES_CONTENT}
        />
        <PublicPolicySection id="politica-publica" />
        <UseCasesSection id="usuarios" />
        <InstitutionsSection id="instituicoes" partners={data.partners} />
      </main>
    </div>
  );
}
