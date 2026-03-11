import { AboutPartnersTabs } from "@/components/AboutPartnersTabs/AboutPartnersTabs";
import { getContent } from "@/utils/contentful";
import type { AboutPageQuery } from "@/utils/interfaces";
import { GET_ABOUT_PAGE } from "@/utils/queries";
import { normalizeContentfulImage } from "@/utils/functions";

const getPageContent = async (): Promise<AboutPageQuery | null> => {
  try {
    return await getContent<AboutPageQuery>(GET_ABOUT_PAGE);
  } catch (error) {
    console.error("Erro ao buscar dados do Contentful:", error);
    return null;
  }
};

export default async function SobreOSapPage() {
  const data = await getPageContent();

  if (!data) {
    return null;
  }

  const allSections = data.secaoSobreCollection?.items ?? [];

  // A primeira entry é o hero ("Página Sobre nós"), as demais são seções com imagem
  const heroEntry = allSections.find((s) =>
    s.title.toLowerCase().includes("sobre nós"),
  );
  const aboutEntries = allSections.filter(
    (s) => s.sys.id !== heroEntry?.sys.id,
  );

  const partnersHeader = data.cabealhoSeesCollection?.items?.[0];
  const partners = data.partnersCollection?.items ?? [];

  if (!partnersHeader) {
    return null;
  }

  const hero = heroEntry
    ? {
        title: heroEntry.title,
        description: heroEntry.text.json,
        imageUrl: normalizeContentfulImage(heroEntry.image.url),
      }
    : undefined;

  const aboutSections = aboutEntries.map((entry) => ({
    title: entry.title,
    text: entry.text.json,
    imageUrl: normalizeContentfulImage(entry.image.url),
    imageAlt: entry.image.title ?? entry.title,
  }));

  return (
    <div className="flex min-h-screen flex-col">
      <main className="grow">
        <AboutPartnersTabs
          hero={hero}
          aboutSections={aboutSections}
          partnersHeader={partnersHeader}
          partners={partners}
        />
      </main>
    </div>
  );
}
