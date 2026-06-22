import { Suspense } from "react";
import { getHomePageContent } from "@/repositories/content/siteContentRepository";
import { LoginPageClient } from "./LoginPageClient";

function normalizeImageUrl(url?: string) {
  if (!url) return undefined;
  return url.startsWith("//") ? `https:${url}` : url;
}

export default async function LoginPage({
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
        <div className="flex min-h-screen items-center justify-center bg-[#4A4E26]">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-white" />
        </div>
      }
    >
      <LoginPageClient backgroundImageUrl={backgroundImageUrl} />
    </Suspense>
  );
}
