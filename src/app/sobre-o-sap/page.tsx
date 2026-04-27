import { AboutPartnersTabs } from "@/components/AboutPartnersTabs/AboutPartnersTabs";
import { getAboutPageContent } from "@/repositories/content/siteContentRepository";

export default async function SobreOSapPage() {
  const data = await getAboutPageContent();

  if (!data) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <main className="grow">
        <AboutPartnersTabs
          hero={data.hero}
          aboutSections={data.aboutSections}
          partnersHeader={data.partnersHeader}
          partners={data.partners}
        />
      </main>
    </div>
  );
}
