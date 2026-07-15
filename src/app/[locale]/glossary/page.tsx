import { GlossarySection } from "@/components/GlossarySection/GlossarySection";
import { getGlossaryTerms } from "@/repositories/content/siteContentRepository";

export default async function GlossaryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const terms = await getGlossaryTerms(locale);

  return (
    <main className="w-full flex justify-center bg-white">
      <GlossarySection terms={terms} />
    </main>
  );
}
