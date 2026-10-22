import { GlossarySection } from "@/components/GlossarySection/GlossarySection";
import { getGlossaryTerms } from "@/repositories/content/siteContentRepository";
import { pageTitleMetadata } from "@/lib/page-metadata";

export const generateMetadata = pageTitleMetadata("glossary");

export default async function GlossaryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const terms = await getGlossaryTerms(locale);

  return (
    <div className="w-full flex justify-center bg-white">
      <GlossarySection terms={terms} />
    </div>
  );
}
