import { AboutPartnersTabs } from "@/components/AboutPartnersTabs/AboutPartnersTabs";
import { getAboutPageContent } from "@/repositories/content/siteContentRepository";
import { getTranslations } from "next-intl/server";

export default async function SobreOSapPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const data = await getAboutPageContent(locale);
  const t = await getTranslations("AboutPartnersTabs");

  if (!data) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-xl">{t("notFound")}</p>
      </div>
    );
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
