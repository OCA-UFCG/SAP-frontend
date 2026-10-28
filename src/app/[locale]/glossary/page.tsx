import { GlossarySection } from "@/components/GlossarySection/GlossarySection";
import {
  getGlossaryHeader,
  getGlossaryTerms,
} from "@/repositories/content/siteContentRepository";
import { pageTitleMetadata } from "@/lib/page-metadata";
import { routing } from "@/translations/routing-config";

export const generateMetadata = pageTitleMetadata("glossary");

export default async function GlossaryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [terms, header] = await Promise.all([
    getGlossaryTerms(locale),
    getGlossaryHeader(locale),
  ]);

  return (
    <div className="w-full flex justify-center bg-white">
      {/* O topo do Contentful está em português; os outros idiomas usam as traduções. */}
      <GlossarySection
        terms={terms}
        header={
          locale === routing.defaultLocale ? (header ?? undefined) : undefined
        }
      />
    </div>
  );
}
