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
import { routing } from "@/translations/routing-config";
import { BLOCKS, Document } from "@contentful/rich-text-types";
import { MOCK_PLATFORM_MODULES_CONTENT } from "../homePage.mocks";
import { getHomeTextsForLocale } from "../homeTexts";

export const generateMetadata = pageTitleMetadata("about");

const EMPTY_TEXT: { json: Document } = {
  json: { nodeType: BLOCKS.DOCUMENT, data: {}, content: [] },
};

/**
 * Cada bloco vem de uma entrada "Sobre e Glossário – Seção" do Contentful; um
 * bloco sem entrada não aparece. Em inglês e espanhol, os textos dos blocos
 * continuam nas traduções e do Contentful vêm as fotos e os números.
 */
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

  const { sections } = data;
  const isPortuguese = locale === routing.defaultLocale;
  const { topo, pab, eixos, equipe, modulos, instituicoes } = sections;
  const gt = sections["grupo-de-trabalho"];
  const paraQuem = sections["para-quem"];
  const actionPlan = {
    title: pab?.title ?? "",
    text: pab?.text ?? EMPTY_TEXT,
    stats: pab?.pairs ?? [],
    axesTitle: eixos?.title ?? "",
    axes: eixos?.axes ?? [],
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="grow">
        {topo && <AboutHero content={topo} />}
        {pab && <ActionPlanSection content={actionPlan} />}
        {gt && (
          <WorkingGroupSection
            content={{
              title: gt.title,
              text: gt.text ?? EMPTY_TEXT,
              milestones: gt.milestones,
            }}
            image={gt.images[0]?.url}
            className="bg-[#F6F7F6]"
          />
        )}
        {eixos && <ThematicAxesSection content={actionPlan} />}
        {paraQuem && (
          <TabsSection contentData={paraQuem.tabs} title={paraQuem.title} />
        )}
        {modulos && (
          <AboutModulesSection
            modules={MOCK_PLATFORM_MODULES_CONTENT.modules}
            texts={homeTexts.tools}
            title={modulos.title}
          />
        )}
        {equipe && (
          <AboutSection
            content={{
              title: equipe.title,
              text: equipe.text,
              image: equipe.images[0],
              rows: equipe.pairs,
            }}
          />
        )}
        <InstitutionsSection
          partners={data.partners}
          title={isPortuguese ? instituicoes?.title : undefined}
        />
      </div>
    </div>
  );
}
