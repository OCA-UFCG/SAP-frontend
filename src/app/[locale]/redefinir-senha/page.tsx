import { Suspense } from "react";
import { getHomePageContent } from "@/repositories/content/siteContentRepository";
import PlatformLoading from "@/app/[locale]/platform/loading";
import { ResetPasswordPageClient } from "./ResetPasswordPageClient";

function normalizeImageUrl(url?: string) {
  if (!url) return undefined;
  return url.startsWith("//") ? `https:${url}` : url;
}

/** Para onde o link do e-mail de troca de senha leva. */
export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const data = await getHomePageContent(locale);
  const backgroundImageUrl = normalizeImageUrl(data?.mainBanner?.image?.url);

  return (
    <Suspense
      fallback={
        <main className="flex min-h-[calc(100vh-4.125rem)] w-full">
          <PlatformLoading />
        </main>
      }
    >
      <ResetPasswordPageClient backgroundImageUrl={backgroundImageUrl} />
    </Suspense>
  );
}
