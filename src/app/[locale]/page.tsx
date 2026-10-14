import { MainBanner } from "@/components/MainBanner/MainBanner";
import { BigNumbersSection } from "@/components/BigNumbersSection/BigNumbersSection";
import { NewsSection } from "@/components/NewsSection/NewsSection";
import { PlatformModulesSection } from "@/components/PlatformModulesSection/PlatformModulesSection";
import { PublicPolicySection } from "@/components/PublicPolicySection/PublicPolicySection";
import { UseCasesSection } from "@/components/UseCasesSection/UseCasesSection";
import { InstitutionsSection } from "@/components/InstitutionsSection/InstitutionsSection";
import { getHomePageContent } from "@/repositories/content/siteContentRepository";
import { getTranslations } from "next-intl/server";
import { MOCK_PLATFORM_MODULES_CONTENT } from "./homePage.mocks";
import { getHomeTextsForLocale } from "./homeTexts";

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [data, texts] = await Promise.all([
    getHomePageContent(locale),
    getHomeTextsForLocale(locale),
  ]);
  const t = await getTranslations("HomePage");

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        <p>{t("contentNotFound")}</p>
      </div>
    );
  }

  // Os ids das seções são os destinos do menu "Início" do topo (layout.tsx).
  return (
    <div className="flex min-h-screen flex-col">
      <main className="grow">
        <MainBanner banners={data.banners} />
        <BigNumbersSection items={texts.highlights} />
        <PlatformModulesSection
          id="a-plataforma"
          content={MOCK_PLATFORM_MODULES_CONTENT}
          texts={texts.tools}
        />
        <PublicPolicySection id="politica-publica" {...texts.publicPolicy} />
        <NewsSection
          id="novidades"
          title={texts.features.title}
          items={texts.features.items}
          toolNames={Object.fromEntries(
            texts.tools.items.map((tool) => [tool.id, tool.name]),
          )}
        />
        <UseCasesSection id="usuarios" {...texts.testimonials} />
        <InstitutionsSection id="instituicoes" partners={data.partners} />
      </main>
    </div>
  );
}
